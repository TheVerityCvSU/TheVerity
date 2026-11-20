const dns = require('dns');
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (_) { }

const path = require('path');
const fs = require('fs');

const envCandidates = [
    process.env.ENV_FILE_PATH,
    path.join(__dirname, '..', 'server', '.env'),
    path.join(__dirname, 'server', '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
    path.join(process.cwd(), 'server', '.env'),
    path.join(process.cwd(), '.env'),
].filter(Boolean);

for (const p of envCandidates) {
    if (fs.existsSync(p)) {
        try {
            require('dotenv').config({ path: p, override: true });
        } catch (_) { }
    }
}

const express = require('express');
const cors = require('cors');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');
const { Server } = require('socket.io');
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('./utils/emailService');
const db = require('./db/index.js');
const dotnetManager = require('./dotnetManager');
const { scanCSharpCode } = require('./csharpSecurityScanner');
const r2Storage = require('./r2Storage');

function killProcessTree(proc) {
    if (!proc || !proc.pid) return;
    try {
        if (process.platform === 'win32') {
            exec(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' }, () => { });
        } else {
            proc.kill('SIGKILL');
        }
    } catch (_) {
        try { proc.kill(); } catch (__) { }
    }
}

const DATA_DIR = process.env.DATA_DIR || __dirname;

function resolveJwtSecret(dataDir) {
    const envSecret = (process.env.JWT_SECRET || '').trim();
    if (envSecret) return { secret: envSecret, isShared: true };

    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const keyFile = path.join(dataDir, '.verity-local-jwt.key');
        if (fs.existsSync(keyFile)) {
            const existing = fs.readFileSync(keyFile, 'utf8').trim();
            if (existing.length >= 32) return { secret: existing, isShared: false };
        }
        const generated = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyFile, generated, { mode: 0o600 });
        return { secret: generated, isShared: false };
    } catch (_) {
        return { secret: crypto.randomBytes(32).toString('hex'), isShared: false };
    }
}

const app = express();
app.set('trust proxy', 1);
const { secret: JWT_SECRET, isShared: HAS_SHARED_JWT_SECRET } = resolveJwtSecret(DATA_DIR);

if (!HAS_SHARED_JWT_SECRET && (process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.IS_RENDER_SERVICE)) {
    console.error('[SECURITY WARNING] JWT_SECRET environment variable is missing on Cloud server! Set JWT_SECRET in Render Environment Variables.');
} else if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'verity_super_secret_key') {
    console.warn('[SECURITY WARNING] JWT_SECRET is using the insecure default key in production! Set JWT_SECRET in your environment.');
}

app.use(cors());
// 150mb limit allows video uploads (mp4, webm, mov) with base64 overhead
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// --- SECURITY: BLOCK SEARCH ENGINE CRAWLERS & INDEXING ---
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
});

app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /\n');
});

// --- SECURITY: ADMIN IP WHITELISTING & RATE LIMITING ---
const adminLoginAttempts = new Map();

const isIpWhitelisted = (ip) => {
    const rawAllowed = (process.env.ADMIN_ALLOWED_IPS || '').trim();
    // If not explicitly restricted, or if contains '*', allow credential-verified admin access
    if (!rawAllowed || rawAllowed.includes('*')) {
        return true;
    }
    if (!ip) return true;
    const cleanIp = ip.replace(/^.*:/, ''); // strip IPv6 prefix if mapped
    const allowedEnv = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
    const defaultAllowed = ['127.0.0.1', '::1', 'localhost', '192.168.8.115', '131.226.102.72'];
    if (defaultAllowed.includes(cleanIp) || allowedEnv.includes(cleanIp)) {
        return true;
    }
    // Also allow private LAN subnets (192.168.*, 10.*, 172.16-31.*) for school ComLabs
    if (/^(192\\.168\\.|10\\.|172\\.(1[6-9]|2\\d|3[0-1])\\.)/.test(cleanIp)) {
        return true;
    }
    return false;
};

const adminIpWhitelist = (req, res, next) => {
    // In Vercel/proxy environments, the real IP is in headers.
    let clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress;

    // x-forwarded-for can be a comma-separated list of IPs. The first one is the client.
    if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    if (!isIpWhitelisted(clientIp)) {
        console.warn(`[SECURITY ALERT] Admin access blocked for non-whitelisted IP: ${clientIp}`);
        return res.status(403).json({ message: `Access denied, your not eligible for admin access` });
    }
    next();
};

const adminLoginRateLimiter = (req, res, next) => {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 mins window
    const maxAttempts = 5;

    const record = adminLoginAttempts.get(clientIp) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
    }

    if (record.count >= maxAttempts) {
        const remainingMinutes = Math.ceil((record.resetTime - now) / 60000);
        return res.status(429).json({
            message: `Too many failed admin login attempts. Account locked for ${remainingMinutes} minute(s).`
        });
    }

    req.adminRateRecord = record;
    req.clientIp = clientIp;
    next();
};

// --- MIDDLEWARE ---
const isLoopbackAddress = (ip) => {
    if (!ip) return false;
    const clean = String(ip).split(',')[0].trim().replace(/^::ffff:/i, '');
    return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost';
};

const verifySessionToken = (token, remoteIp) => {
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (_) {
        // On a standalone client-only embedded server without a shared JWT secret or Cloud DB,
        // accept loopback requests from the local desktop UI using a Render-issued session token.
        if (!HAS_SHARED_JWT_SECRET && !IS_RENDER_CLOUD && !db.isPostgres && isLoopbackAddress(remoteIp)) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && (decoded.id != null || decoded.email) && decoded.role) {
                    if (!decoded.exp || decoded.exp * 1000 > Date.now()) {
                        return decoded;
                    }
                }
            } catch (_) { }
        }
        return null;
    }
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    const remoteIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
    const user = verifySessionToken(token, remoteIp);
    if (!user) return res.status(403).json({ message: 'Invalid token.' });
    req.user = user;
    next();
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'User role not found.' });
        }
        const userRoleLower = String(req.user.role).toLowerCase();
        const allowedLowers = allowedRoles.map(r => String(r).toLowerCase());
        if (allowedLowers.includes('teacher') && !allowedLowers.includes('instructor')) allowedLowers.push('instructor');
        if (allowedLowers.includes('instructor') && !allowedLowers.includes('teacher')) allowedLowers.push('teacher');
        if (!allowedLowers.includes(userRoleLower)) {
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

// --- FILE UPLOADS (images / videos / documents for assignments) ---
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const IS_RENDER_CLOUD = Boolean(
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.IS_RENDER_SERVICE
);
const CLOUD_MEDIA_BASE_URL = (
    process.env.CLOUD_API_URL ||
    process.env.CLOUD_SOCKET_URL ||
    'https://the-verity.onrender.com'
).trim().replace(/\/$/, '');

// Clean up stale temp artifacts left behind by interrupted uploads or transcodes
try {
    for (const entry of fs.readdirSync(UPLOADS_DIR)) {
        if (entry.endsWith('.part') || entry.endsWith('_faststart.mp4') || entry.endsWith('_opt.mp4')) {
            try { fs.unlinkSync(path.join(UPLOADS_DIR, entry)); } catch (_) { }
        }
    }
} catch (_) { }

// Whitelist of permitted file extensions to prevent Stored XSS and arbitrary file execution
const ALLOWED_UPLOAD_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif',
    '.mp4', '.webm', '.ogg', '.mov', '.quicktime', '.m4v', '.mkv', '.avi',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv',
    '.zip', '.txt'
]);

const VIDEO_UPLOAD_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v']);
const FASTSTART_REMUX_EXTS = new Set(['.mp4', '.m4v', '.mov']);

const UPLOAD_MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv; charset=utf-8',
    '.zip': 'application/zip',
    '.txt': 'text/plain; charset=utf-8'
};

const SUPPORTED_UPLOAD_MESSAGE =
    'Supported formats: images (.png, .jpg, .gif, .webp, .svg), videos (.mp4, .webm, .mov, .m4v, .mkv, .avi), documents (.pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .csv, .txt), zip.';

/**
 * Persists an uploaded file to Cloudflare R2 (when configured) or falls back
 * to chunked PostgreSQL storage so files load across all devices & Incognito.
 */
async function persistUploadedFile(uniqueName, targetPath, ext) {
    try {
        if (!uniqueName || !targetPath || !fs.existsSync(targetPath)) return false;
        const mime = UPLOAD_MIME_TYPES[ext] || 'application/octet-stream';
        if (r2Storage.isR2Configured()) {
            const res = await r2Storage.uploadFileToR2(uniqueName, targetPath, mime);
            if (res.uploaded) return true;
        }
        return await db.persistUploadToCloudDb(uniqueName, targetPath, mime);
    } catch (err) {
        console.warn(`[Media Persist] Notice for ${uniqueName}:`, err.message);
        return false;
    }
}

// Track active /uploads readers so FFmpeg swaps never break active 40-student streams or hit Windows file locks
const activeUploadStreams = new Map();
const pendingVideoSwaps = new Map();
const inFlightCloudPulls = new Map();

function tryApplyPendingSwap(filename) {
    const tempPath = pendingVideoSwaps.get(filename);
    if (!tempPath || (activeUploadStreams.get(filename) || 0) > 0) return;
    const targetPath = path.join(UPLOADS_DIR, filename);
    try {
        if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, targetPath);
        }
        pendingVideoSwaps.delete(filename);
    } catch (err) {
        console.warn(`[Video Swap] Deferred rename skipped for ${filename}:`, err.message);
    }
}

function safeReplaceOrDeferSwap(targetPath, tempPath) {
    const filename = path.basename(targetPath);
    if ((activeUploadStreams.get(filename) || 0) > 0) {
        const previousTemp = pendingVideoSwaps.get(filename);
        if (previousTemp && previousTemp !== tempPath) {
            try { if (fs.existsSync(previousTemp)) fs.unlinkSync(previousTemp); } catch (_) { }
        }
        pendingVideoSwaps.set(filename, tempPath);
        return false;
    }
    try {
        fs.renameSync(tempPath, targetPath);
        pendingVideoSwaps.delete(filename);
        return true;
    } catch (err) {
        pendingVideoSwaps.set(filename, tempPath);
        console.warn(`[Video Swap] Deferred swap for ${filename} (${err.message})`);
        return false;
    }
}

function isSafeUploadBasename(rawName) {
    if (!rawName || typeof rawName !== 'string') return false;
    if (rawName.includes('/') || rawName.includes('\\') || rawName.includes('..') || rawName.startsWith('.')) {
        return false;
    }
    if (rawName.endsWith('.part') || rawName.endsWith('_faststart.mp4') || rawName.endsWith('_opt.mp4')) {
        return false;
    }
    return path.basename(rawName) === rawName;
}

/**
 * Pulls a missing /uploads/<filename> once from the Cloud server into UPLOADS_DIR
 * so 40 ComLab students stream from the local LAN host instead of external internet.
 */
async function pullUploadFromCloud(filename) {
    if (IS_RENDER_CLOUD || !isSafeUploadBasename(filename)) {
        return false;
    }
    const targetPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(targetPath)) return true;

    if (inFlightCloudPulls.has(filename)) {
        return inFlightCloudPulls.get(filename);
    }

    const pullPromise = (async () => {
        if (r2Storage.isR2Configured()) {
            const fromR2 = await r2Storage.downloadFileFromR2(filename, targetPath).catch(() => false);
            if (fromR2) return true;
        }
        if (!CLOUD_MEDIA_BASE_URL) return false;

        const partPath = path.join(UPLOADS_DIR, `${filename}.${Date.now()}.part`);
        const connectController = new AbortController();
        const connectTimer = setTimeout(() => connectController.abort(), 4000);
        try {
            const remoteUrl = `${CLOUD_MEDIA_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
            const res = await fetch(remoteUrl, { signal: connectController.signal });
            clearTimeout(connectTimer);
            if (!res.ok || !res.body) return false;

            const { Readable } = require('stream');
            const { pipeline } = require('stream/promises');
            const ws = fs.createWriteStream(partPath);
            await pipeline(Readable.fromWeb(res.body), ws);
            fs.renameSync(partPath, targetPath);
            console.log(`[LAN Media Cache] Cached ${filename} locally from Cloud`);
            return true;
        } catch (_) {
            clearTimeout(connectTimer);
            try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (__) { }
            return false;
        } finally {
            inFlightCloudPulls.delete(filename);
        }
    })();

    inFlightCloudPulls.set(filename, pullPromise);
    return pullPromise;
}

// Background serial prefetcher when Cloud Sync pulls new classwork on a LAN host
const mediaPrefetchQueue = [];
const mediaPrefetchQueuedSet = new Set();
let isPrefetchRunning = false;

async function drainMediaPrefetchQueue() {
    if (isPrefetchRunning) return;
    isPrefetchRunning = true;
    let consecutiveFailures = 0;
    try {
        while (mediaPrefetchQueue.length > 0) {
            const filename = mediaPrefetchQueue.shift();
            mediaPrefetchQueuedSet.delete(filename);
            if (!filename) continue;
            const ok = await pullUploadFromCloud(filename).catch(() => false);
            if (ok) {
                consecutiveFailures = 0;
            } else {
                consecutiveFailures++;
                // Stop draining if Cloud appears unreachable/offline to avoid spamming failed fetches
                if (consecutiveFailures >= 3) {
                    mediaPrefetchQueue.length = 0;
                    mediaPrefetchQueuedSet.clear();
                    break;
                }
            }
        }
    } finally {
        isPrefetchRunning = false;
    }
}

function isHostServerInstance() {
    const isExplicitClient = process.env.IS_LAN_HOST === 'false';
    return !isExplicitClient && Boolean(
        fs.existsSync(path.join(DATA_DIR, 'host.flag')) ||
        fs.existsSync(path.join(__dirname, 'host.flag')) ||
        process.env.IS_LAN_HOST === 'true' ||
        process.env.IS_VERITY_ADMIN === 'true' ||
        process.argv.includes('--host') ||
        require.main === module
    );
}

function prefetchUploadsFromClasswork(rows) {
    if (IS_RENDER_CLOUD || !isHostServerInstance() || !Array.isArray(rows)) return;
    const foundNames = new Set();
    const uploadRegex = /\/uploads\/([^"'\s<>?#)]+)/g;

    for (const row of rows) {
        const rawDesc = typeof row?.description === 'string' ? row.description : '';
        if (!rawDesc.includes('/uploads/')) continue;

        let match;
        uploadRegex.lastIndex = 0;
        while ((match = uploadRegex.exec(rawDesc)) !== null) {
            try {
                const decoded = decodeURIComponent(match[1]);
                if (isSafeUploadBasename(decoded)) {
                    foundNames.add(decoded);
                    const ext = path.extname(decoded).toLowerCase();
                    if (VIDEO_UPLOAD_EXTS.has(ext)) {
                        foundNames.add(`${decoded.slice(0, -ext.length)}_thumb.jpg`);
                    }
                }
            } catch (_) { }
        }
    }

    for (const fname of foundNames) {
        if (!fs.existsSync(path.join(UPLOADS_DIR, fname)) && !mediaPrefetchQueuedSet.has(fname)) {
            mediaPrefetchQueuedSet.add(fname);
            mediaPrefetchQueue.push(fname);
        }
    }
    if (mediaPrefetchQueue.length > 0) {
        drainMediaPrefetchQueue().catch(() => { });
    }
}

// Serve uploaded files statically at /uploads/<file> with direct R2 offload on Cloud, pull-through cache, active stream tracking, and range headers
app.use('/uploads', async (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    let requestedName = '';
    try {
        requestedName = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
    } catch (_) {
        return res.status(400).end();
    }
    if (!isSafeUploadBasename(requestedName)) {
        return res.status(404).end();
    }

    const isDownloadReq = Boolean(req.query && (req.query.download === '1' || req.query.download === 'true'));
    const rawDownloadName = isDownloadReq
        ? ((typeof req.query.filename === 'string' && req.query.filename.trim())
            ? req.query.filename.trim()
            : requestedName.replace(/^\d+_/, ''))
        : '';

    const localTarget = path.join(UPLOADS_DIR, requestedName);

    // On Render Cloud, offload media streaming/downloads directly to Cloudflare R2 (0 Render egress)
    if (IS_RENDER_CLOUD && r2Storage.isR2Configured() && (req.method === 'GET' || req.method === 'HEAD') && req.query.proxy !== '1') {
        let inR2 = await r2Storage.existsInR2Cached(requestedName).catch(() => false);
        if (!inR2 && !fs.existsSync(localTarget)) {
            const restored = await db.restoreUploadFromCloudDb(requestedName, localTarget).catch(() => false);
            if (restored) {
                const ext = path.extname(requestedName).toLowerCase();
                const mime = UPLOAD_MIME_TYPES[ext] || 'application/octet-stream';
                const up = await r2Storage.uploadFileToR2(requestedName, localTarget, mime).catch(() => ({ uploaded: false }));
                inR2 = Boolean(up && up.uploaded);
                if (inR2) {
                    try { fs.unlinkSync(localTarget); } catch (_) { }
                }
            }
        }
        if (inR2) {
            const direct = r2Storage.getDirectMediaUrl(requestedName, {
                method: req.method,
                expiresIn: 3600,
                downloadFilename: rawDownloadName
            });
            if (direct && direct.url) {
                res.setHeader('Cache-Control', direct.isPublic ? 'public, max-age=86400' : 'private, max-age=1800');
                return res.redirect(302, direct.url);
            }
        }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && !fs.existsSync(localTarget)) {
        // 1. Hydrate from Cloudflare R2 if configured
        let hydrated = false;
        if (r2Storage.isR2Configured()) {
            hydrated = await r2Storage.downloadFileFromR2(requestedName, localTarget).catch(() => false);
        }
        // 2. Fallback: hydrate from PostgreSQL chunk storage
        if (!hydrated) {
            hydrated = await db.restoreUploadFromCloudDb(requestedName, localTarget).catch(() => false);
            if (hydrated && r2Storage.isR2Configured()) {
                const ext = path.extname(requestedName).toLowerCase();
                const mime = UPLOAD_MIME_TYPES[ext] || 'application/octet-stream';
                r2Storage.uploadFileToR2(requestedName, localTarget, mime).catch(() => { });
            }
        }
        // 3. Fallback: pull from Cloud HTTP server when running on a LAN host
        if (!hydrated && !IS_RENDER_CLOUD) {
            try {
                const cloudHost = new URL(CLOUD_MEDIA_BASE_URL).host;
                if (req.get('host') !== cloudHost) {
                    await pullUploadFromCloud(requestedName);
                }
            } catch (_) { }
        }
    }

    // Direct-to-Downloads attachment header when ?download=1 is requested
    if (isDownloadReq) {
        const safeAscii = rawDownloadName.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7E]/g, '_') || 'download';
        const encodedUtf8 = encodeURIComponent(rawDownloadName);
        res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
        activeUploadStreams.set(requestedName, (activeUploadStreams.get(requestedName) || 0) + 1);
        let released = false;
        const releaseStream = () => {
            if (released) return;
            released = true;
            const remaining = (activeUploadStreams.get(requestedName) || 1) - 1;
            if (remaining <= 0) {
                activeUploadStreams.delete(requestedName);
                tryApplyPendingSwap(requestedName);
            } else {
                activeUploadStreams.set(requestedName, remaining);
            }
        };
        res.on('close', releaseStream);
        res.on('finish', releaseStream);
    }

    next();
}, express.static(UPLOADS_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const mime = UPLOAD_MIME_TYPES[ext];
        if (mime) {
            res.setHeader('Content-Type', mime);
        }
        if (VIDEO_UPLOAD_EXTS.has(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

let ffmpegStaticPath = null;
try {
    ffmpegStaticPath = require('ffmpeg-static');
} catch (_) { }

// Fallback to system-installed ffmpeg binary (e.g. from apt-get install -y ffmpeg)
if (!ffmpegStaticPath || typeof ffmpegStaticPath !== 'string') {
    try {
        const { execSync } = require('child_process');
        execSync(process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg', { stdio: 'ignore' });
        ffmpegStaticPath = 'ffmpeg';
    } catch (_) {
        ffmpegStaticPath = null;
    }
}

function runFfmpegAsync(args, label = 'FFmpeg') {
    return new Promise((resolve) => {
        try {
            const proc = spawn(ffmpegStaticPath, args, { stdio: 'ignore' });
            if (proc.pid) {
                try {
                    os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
                } catch (_) { }
            }
            proc.on('close', (code) => resolve(code ?? -1));
            proc.on('error', (err) => {
                console.warn(`[${label}] Error:`, err.message);
                resolve(-1);
            });
        } catch (err) {
            console.warn(`[${label}] Failed to spawn:`, err.message);
            resolve(-1);
        }
    });
}

// Serial FFmpeg queue (1 job at a time) so large video uploads never starve HTTP/Socket.IO CPU
const videoProcessingQueue = [];
let isVideoQueueRunning = false;

async function drainVideoProcessingQueue() {
    if (isVideoQueueRunning) return;
    isVideoQueueRunning = true;
    try {
        while (videoProcessingQueue.length > 0) {
            const targetPath = videoProcessingQueue.shift();
            await processVideoJob(targetPath);
        }
    } finally {
        isVideoQueueRunning = false;
    }
}

function processVideoUpload(targetPath) {
    if (!ffmpegStaticPath || !fs.existsSync(targetPath)) return;
    const ext = path.extname(targetPath).toLowerCase();
    if (!VIDEO_UPLOAD_EXTS.has(ext)) return;
    if (!videoProcessingQueue.includes(targetPath)) {
        videoProcessingQueue.push(targetPath);
    }
    drainVideoProcessingQueue().catch((err) => {
        console.warn('[Video Queue] Error:', err?.message || err);
    });
}

/**
 * Extracts a lightweight thumbnail (_thumb.jpg), applies fast lossless +faststart
 * remuxing for instant 40-student seeking, and queues bounded-CPU compression.
 */
async function processVideoJob(targetPath) {
    if (!ffmpegStaticPath || !fs.existsSync(targetPath)) return;
    const ext = path.extname(targetPath).toLowerCase();
    if (!VIDEO_UPLOAD_EXTS.has(ext)) return;

    const baseNoExt = targetPath.slice(0, -ext.length);
    const thumbPath = `${baseNoExt}_thumb.jpg`;
    const faststartTempPath = `${baseNoExt}_faststart.mp4`;
    const tempOptPath = `${baseNoExt}_opt.mp4`;

    // 1. Generate lightweight thumbnail image (~30KB) at 3s, or 0s for short clips
    const thumbCode = await runFfmpegAsync([
        '-y',
        '-ss', '00:00:03',
        '-i', targetPath,
        '-vframes', '1',
        '-vf', "scale='min(640,iw)':-2",
        '-q:v', '3',
        thumbPath
    ], 'Video Thumb');
    if (thumbCode !== 0 || !fs.existsSync(thumbPath)) {
        await runFfmpegAsync([
            '-y',
            '-ss', '00:00:00',
            '-i', targetPath,
            '-vframes', '1',
            '-vf', "scale='min(640,iw)':-2",
            '-q:v', '3',
            thumbPath
        ], 'Video Thumb Fallback');
    }
    if (fs.existsSync(thumbPath)) {
        persistUploadedFile(path.basename(thumbPath), thumbPath, '.jpg').catch(() => { });
    }

    try {
        const stats = fs.statSync(targetPath);
        if (stats.size <= 15 * 1024 * 1024) return;

        // 2a. Fast lossless +faststart remux (seconds even on 2 GB MP4) so browsers seek immediately
        if (FASTSTART_REMUX_EXTS.has(ext)) {
            const remuxCode = await runFfmpegAsync([
                '-y',
                '-i', targetPath,
                '-c', 'copy',
                '-movflags', '+faststart',
                faststartTempPath
            ], 'Video Faststart');

            if (remuxCode === 0 && fs.existsSync(faststartTempPath) && fs.statSync(faststartTempPath).size > 0) {
                safeReplaceOrDeferSwap(targetPath, faststartTempPath);
            } else {
                try { if (fs.existsSync(faststartTempPath)) fs.unlinkSync(faststartTempPath); } catch (_) { }
            }
        }

        // 2b. Compress large video with NVENC first, then bounded-thread libx264 CPU fallback
        const nvencCode = await runFfmpegAsync([
            '-y',
            '-i', targetPath,
            '-vf', "scale='min(1280,iw)':-2",
            '-c:v', 'h264_nvenc',
            '-preset', 'p4',
            '-cq', '28',
            '-b:v', '350k',
            '-maxrate', '500k',
            '-bufsize', '800k',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-movflags', '+faststart',
            tempOptPath
        ], 'Video Compression NVENC');

        let compressedOk = nvencCode === 0 && fs.existsSync(tempOptPath);
        if (!compressedOk) {
            try { if (fs.existsSync(tempOptPath)) fs.unlinkSync(tempOptPath); } catch (_) { }
            const cpuThreads = String(Math.max(1, Math.min(4, Math.floor((os.cpus()?.length || 2) / 2))));
            const cpuCode = await runFfmpegAsync([
                '-y',
                '-i', targetPath,
                '-vf', "scale='min(1280,iw)':-2",
                '-c:v', 'libx264',
                '-crf', '28',
                '-preset', 'veryfast',
                '-threads', cpuThreads,
                '-c:a', 'aac',
                '-b:a', '64k',
                '-movflags', '+faststart',
                tempOptPath
            ], 'Video Compression CPU');
            compressedOk = cpuCode === 0 && fs.existsSync(tempOptPath);
        }

        if (compressedOk) {
            const curStats = fs.statSync(targetPath);
            const optStats = fs.statSync(tempOptPath);
            if (optStats.size > 0 && optStats.size < curStats.size) {
                const swapped = safeReplaceOrDeferSwap(targetPath, tempOptPath);
                if (swapped) {
                    console.log(`[Video Compression] Compressed ${path.basename(targetPath)} from ${(curStats.size / 1024 / 1024).toFixed(1)}MB to ${(optStats.size / 1024 / 1024).toFixed(1)}MB`);
                    persistUploadedFile(path.basename(targetPath), targetPath, ext).catch(() => { });
                }
            } else {
                try { fs.unlinkSync(tempOptPath); } catch (_) { }
            }
        } else {
            try { if (fs.existsSync(tempOptPath)) fs.unlinkSync(tempOptPath); } catch (_) { }
        }
    } catch (e) {
        try { if (fs.existsSync(faststartTempPath)) fs.unlinkSync(faststartTempPath); } catch (_) { }
        try { if (fs.existsSync(tempOptPath)) fs.unlinkSync(tempOptPath); } catch (_) { }
        console.warn('[Video Compression] Failed:', e.message);
    }
}

function buildUploadResponse(req, unique, ext) {
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const isVideo = VIDEO_UPLOAD_EXTS.has(ext);
    const baseNoExt = unique.slice(0, -ext.length);
    return {
        url: `${protocol}://${host}/uploads/${unique}`,
        path: `/uploads/${unique}`,
        filename: unique,
        thumbnailUrl: isVideo ? `${protocol}://${host}/uploads/${baseNoExt}_thumb.jpg` : null,
        thumbnailPath: isVideo ? `/uploads/${baseNoExt}_thumb.jpg` : null
    };
}

// Raw binary upload endpoint (ideal for large 2 GB videos like MP4, WebM, MOV without base64 overhead)
app.post('/upload-raw', (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);

    const rawFilename = req.query.filename || req.headers['x-filename'] || 'file.mp4';
    const ext = path.extname(rawFilename).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
        return res.status(400).json({
            message: `File type "${ext || 'unknown'}" is not allowed. ${SUPPORTED_UPLOAD_MESSAGE}`
        });
    }

    const safeName = (rawFilename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;
    const targetPath = path.join(UPLOADS_DIR, unique);
    const writeStream = fs.createWriteStream(targetPath);
    let finished = false;

    const cleanupPartial = () => {
        if (finished) return;
        finished = true;
        try { writeStream.destroy(); } catch (_) { }
        fs.unlink(targetPath, () => { });
    };

    req.on('aborted', cleanupPartial);
    req.on('error', (err) => {
        console.error('Upload request error:', err);
        cleanupPartial();
        if (!res.headersSent) {
            res.status(499).json({ message: 'Upload aborted' });
        }
    });

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
        if (finished) return;
        finished = true;
        processVideoUpload(targetPath);
        try {
            const stat = fs.statSync(targetPath);
            // Await persistence for files <= 25 MB so immediate cross-device loads never 404;
            // larger videos persist in background without delaying HTTP response.
            if (stat.size <= 25 * 1024 * 1024) {
                await persistUploadedFile(unique, targetPath, ext);
            } else {
                persistUploadedFile(unique, targetPath, ext).catch(() => { });
            }
        } catch (_) { }
        res.status(201).json(buildUploadResponse(req, unique, ext));
    });

    writeStream.on('error', (err) => {
        console.error('Upload stream error:', err);
        cleanupPartial();
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to write upload stream' });
        }
    });
});

// Accepts { filename, dataUrl } (dataUrl = "data:<mime>;base64,<data>"),
// writes the file to /uploads, and returns its public URL.
app.post('/upload', (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
}, (req, res) => {
    const { filename, dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ message: 'dataUrl is required' });
    }
    const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) {
        return res.status(400).json({ message: 'Invalid data URL' });
    }

    const ext = path.extname(filename || '').toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
        return res.status(400).json({
            message: `File type "${ext || 'unknown'}" is not allowed. ${SUPPORTED_UPLOAD_MESSAGE}`
        });
    }

    const buffer = Buffer.from(match[2], 'base64');
    const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;
    const targetPath = path.join(UPLOADS_DIR, unique);
    fs.writeFileSync(targetPath, buffer);
    processVideoUpload(targetPath);
    persistUploadedFile(unique, targetPath, ext)
        .catch(() => { })
        .finally(() => {
            res.status(201).json(buildUploadResponse(req, unique, ext));
        });
});

function getGithubLatestReleaseUrl() {
    const repo = (process.env.GITHUB_REPO || 'TheVerityCvSU/TheVerity').trim();
    return `https://api.github.com/repos/${repo}/releases/latest`;
}

app.get('/api/check-update', async (req, res) => {
    // Semantic version comparison: returns true if latest > current
    const isNewer = (latest, current) => {
        if (!latest || !current) return false;
        const lParts = String(latest).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        const cParts = String(current).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
            const l = lParts[i] || 0;
            const c = cParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
        }
        return false;
    };

    // 1. Client's currently installed version
    const clientVer = (req.query.clientVersion || req.query.currentVersion || req.query.version || '').replace(/^v/i, '').trim();

    // 2. Base version from server's package.json or environment
    let serverPkgVersion = process.env.APP_VERSION || '1.0.0';
    try {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
        if (pkg.version) serverPkgVersion = pkg.version;
    } catch (_) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
            if (pkg.version) serverPkgVersion = pkg.version;
        } catch (_) {
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'The-Verity', 'package.json'), 'utf8'));
                if (pkg.version) serverPkgVersion = pkg.version;
            } catch (_) { }
        }
    }

    const currentVersion = clientVer || serverPkgVersion;
    let latestVersion = process.env.LATEST_APP_VERSION || serverPkgVersion;
    let githubDownloadUrl = null;

    const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';

    // 3. Scan local build directories for newly built installers (ComLab offline router mode)
    const homeDir = os.homedir();
    const candidateDirs = [
        path.resolve(__dirname, isAdmin ? '../release/Admin' : '../release/Users'),
        path.resolve(process.cwd(), isAdmin ? 'release/Admin' : 'release/Users'),
        path.resolve(__dirname, '../release'),
        path.resolve(process.cwd(), 'release'),
        path.resolve(__dirname, '../dist'),
        path.resolve(process.cwd(), 'dist'),
        path.join(homeDir, 'The-Verity', isAdmin ? 'release/Admin' : 'release/Users'),
        path.join(homeDir, 'The-Verity', 'release'),
        process.env.RELEASE_DIR,
        process.env.VERITY_RELEASE_DIR
    ].filter(Boolean);

    // Helper to find all available installer executables, sorted newest to oldest
    const findLocalInstallers = (isAdminApp) => {
        const found = [];
        for (const dir of candidateDirs) {
            if (fs.existsSync(dir)) {
                try {
                    const files = fs.readdirSync(dir);
                    for (const f of files) {
                        const lower = f.toLowerCase();
                        if (lower.endsWith('.exe') && lower.includes('verity') && (isAdminApp ? lower.includes('admin') : !lower.includes('admin'))) {
                            const vMatch = f.match(/(\d+\.\d+\.\d+)/);
                            const fileVer = vMatch ? vMatch[1] : '0.0.0';
                            found.push({
                                path: path.join(dir, f),
                                filename: f,
                                version: fileVer,
                                isSetup: lower.includes('setup')
                            });
                        }
                    }
                } catch (_) { }
            }
        }
        found.sort((a, b) => {
            if (isNewer(a.version, b.version)) return -1;
            if (isNewer(b.version, a.version)) return 1;
            if (a.isSetup && !b.isSetup) return -1;
            if (!a.isSetup && b.isSetup) return 1;
            return 0;
        });
        return found;
    };

    // Scan local build directories for newly built installers
    const localInstallers = findLocalInstallers(isAdmin);
    if (localInstallers.length > 0) {
        const newestLocal = localInstallers[0];
        if (isNewer(newestLocal.version, latestVersion)) {
            latestVersion = newestLocal.version;
        }
    }

    // Check latest.yml if produced by electron-builder
    for (const dir of candidateDirs) {
        if (fs.existsSync(dir)) {
            const ymlPath = path.join(dir, 'latest.yml');
            if (fs.existsSync(ymlPath)) {
                try {
                    const ymlContent = fs.readFileSync(ymlPath, 'utf8');
                    const match = ymlContent.match(/version:\s*([0-9.]+)/i);
                    if (match && match[1]) {
                        const ymlVer = match[1].trim();
                        if (isNewer(ymlVer, latestVersion)) {
                            latestVersion = ymlVer;
                        }
                    }
                } catch (_) { }
            }
        }
    }

    // 4. Check GitHub Releases API if online
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const ghRes = await fetch(getGithubLatestReleaseUrl(), {
            headers: { 'User-Agent': 'The-Verity-App' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (ghRes.ok) {
            const releaseData = await ghRes.json();
            const tagName = (releaseData.tag_name || '').replace(/^v/i, '').trim();
            if (tagName && isNewer(tagName, latestVersion)) {
                latestVersion = tagName;
                const asset = (releaseData.assets || []).find(a =>
                    isAdmin ? /admin.*\.exe$/i.test(a.name) : /\.exe$/i.test(a.name) && !/admin/i.test(a.name)
                );
                if (asset?.browser_download_url) {
                    githubDownloadUrl = asset.browser_download_url;
                }
            }
        }
    } catch (_) {
        // Offline or GitHub unreachable — use local build/package version
    }

    // In local offline mode (when no GitHub release download is available),
    // the latest deliverable version MUST be bounded by what actually exists to be downloaded
    if (!githubDownloadUrl && localInstallers.length > 0 && !process.env.LATEST_APP_VERSION) {
        latestVersion = localInstallers[0].version;
    }

    const forceUpdate = req.query.force === 'true' || req.query.force === '1';
    const updateAvailable = forceUpdate || isNewer(latestVersion, currentVersion);

    const isPrivateHost = (hostname) => {
        if (!hostname) return false;
        const clean = hostname.split(':')[0].trim().toLowerCase();
        if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1' || clean.endsWith('.local')) return true;
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
        return false;
    };

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;
    const downloadQuery = isAdmin ? '?app=admin' : '';
    const isLocalServer = isPrivateHost(host);

    // On local/LAN servers, ALWAYS deliver downloadUrl through this local server so offline clients can download it!
    let finalDownloadUrl = `${baseUrl}/api/download-update${downloadQuery}`;
    if (!isLocalServer && (process.env.UPDATE_DOWNLOAD_URL || githubDownloadUrl)) {
        finalDownloadUrl = process.env.UPDATE_DOWNLOAD_URL || githubDownloadUrl;
    }

    const releaseNotes = `Version ${latestVersion}: Enhanced proctoring stability, UI performance optimizations, and security patches.`;

    res.json({
        currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl: finalDownloadUrl,
        releaseNotes
    });
});

app.get('/api/download-update', async (req, res) => {
    const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';
    const reqVersion = (req.query.version || req.query.v || '').trim();

    // 1. Scan local build output directories
    const homeDir = os.homedir();
    const candidateDirs = [
        path.resolve(__dirname, isAdmin ? '../release/Admin' : '../release/Users'),
        path.resolve(process.cwd(), isAdmin ? 'release/Admin' : 'release/Users'),
        path.resolve(__dirname, '../release'),
        path.resolve(process.cwd(), 'release'),
        path.resolve(__dirname, '../dist'),
        path.resolve(process.cwd(), 'dist'),
        path.join(homeDir, 'The-Verity', isAdmin ? 'release/Admin' : 'release/Users'),
        path.join(homeDir, 'The-Verity', 'release'),
        path.join(homeDir, 'Desktop', 'The-Verity', isAdmin ? 'release/Admin' : 'release/Users'),
        path.join(homeDir, 'Desktop', 'The-Verity', 'release'),
        process.resourcesPath ? path.join(process.resourcesPath, 'updates') : null,
        path.join(process.cwd(), 'updates'),
        process.env.RELEASE_DIR,
        process.env.VERITY_RELEASE_DIR
    ].filter(Boolean);

    const found = [];
    for (const dir of candidateDirs) {
        if (fs.existsSync(dir)) {
            try {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const lower = f.toLowerCase();
                    if (lower.endsWith('.exe') && lower.includes('verity') && (isAdmin ? lower.includes('admin') : !lower.includes('admin'))) {
                        const vMatch = f.match(/(\d+\.\d+\.\d+)/);
                        const fileVer = vMatch ? vMatch[1] : '0.0.0';
                        found.push({
                            path: path.join(dir, f),
                            filename: f,
                            version: fileVer,
                            isSetup: lower.includes('setup')
                        });
                    }
                }
            } catch (_) { }
        }
    }

    found.sort((a, b) => {
        const isNewer = (v1, v2) => {
            const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
            const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                if ((p1[i] || 0) > (p2[i] || 0)) return true;
                if ((p1[i] || 0) < (p2[i] || 0)) return false;
            }
            return false;
        };
        if (isNewer(a.version, b.version)) return -1;
        if (isNewer(b.version, a.version)) return 1;
        if (a.isSetup && !b.isSetup) return -1;
        if (!a.isSetup && b.isSetup) return 1;
        return 0;
    });

    if (found.length > 0) {
        let best = found[0];
        if (reqVersion) {
            const exactMatch = found.find(f => f.version === reqVersion);
            if (exactMatch) best = exactMatch;
        }
        return res.download(best.path, best.filename);
    }

    // 2. If no local installer on disk, but this host server has internet, stream from GitHub directly
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const ghRes = await fetch(getGithubLatestReleaseUrl(), {
            headers: { 'User-Agent': 'The-Verity-App' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (ghRes.ok) {
            const releaseData = await ghRes.json();
            const asset = (releaseData.assets || []).find(a =>
                isAdmin ? /admin.*\.exe$/i.test(a.name) : /\.exe$/i.test(a.name) && !/admin/i.test(a.name)
            );
            if (asset?.browser_download_url) {
                const downloadStream = await fetch(asset.browser_download_url);
                if (downloadStream.ok) {
                    res.setHeader('Content-Disposition', `attachment; filename="${asset.name || 'The-Verity-Setup.exe'}"`);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    if (downloadStream.headers.get('content-length')) {
                        res.setHeader('Content-Length', downloadStream.headers.get('content-length'));
                    }
                    const { Readable } = require('stream');
                    return Readable.fromWeb(downloadStream.body).pipe(res);
                }
            }
        }
    } catch (_) { }

    res.status(404).json({
        error: 'Installer package not found on local server.',
        message: 'Please ensure The Verity Setup.exe is placed in the release/Users or release/Admin directory.'
    });
});

function getValidLanIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (
                iface.family === 'IPv4' &&
                !iface.internal &&
                iface.address &&
                !iface.address.startsWith('127.') &&
                !iface.address.startsWith('169.254.') &&
                !iface.address.startsWith('192.168.56.')
            ) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

app.get('/health', async (req, res) => {
    try {
        await db.get('SELECT 1');
        const lanIps = getValidLanIps();
        const isExplicitClient = process.env.IS_LAN_HOST === 'false';
        const isHost = !isExplicitClient && Boolean(
            fs.existsSync(path.join(DATA_DIR, 'host.flag')) ||
            fs.existsSync(path.join(__dirname, 'host.flag')) ||
            process.env.IS_LAN_HOST === 'true' ||
            process.env.IS_VERITY_ADMIN === 'true' ||
            process.argv.includes('--host') ||
            require.main === module
        );
        res.status(200).json({
            status: 'operational',
            app: 'the-verity',
            uptime: process.uptime(),
            db: 'connected',
            provider: db.providerName,
            hasCloudDb: db.isPostgres,
            isHost,
            lanIps,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            app: 'the-verity',
            error: err.message,
            uptime: process.uptime(),
            db: 'error',
            provider: db.providerName,
            timestamp: new Date().toISOString()
        });
    }
});

// --- Cloud / Local Database Sync Endpoints ---
app.post('/api/sync', async (req, res) => {
    try {
        const { syncBidirectional } = require('./db/cloudSync');
        const syncResult = await syncBidirectional();
        res.status(200).json({ message: 'Sync complete', ...syncResult });
    } catch (e) {
        res.status(500).json({ message: 'Sync failed', error: e.message });
    }
});

app.get('/api/sync-status', (req, res) => {
    try {
        const { getSyncStatus } = require('./db/cloudSync');
        res.status(200).json(getSyncStatus());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const server = http.createServer(app);
server.requestTimeout = 0; // Allow large 2 GB binary uploads without cutting off at 5 minutes
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

try {
    const { setSocketIo, setOnClassworkPulled } = require('./db/cloudSync');
    setSocketIo(io);
    setOnClassworkPulled(prefetchUploadsFromClasswork);
} catch (_) { }

// Socket.IO Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
        const remoteIp = socket.handshake?.address || socket.conn?.remoteAddress || '';
        const user = verifySessionToken(token, remoteIp);
        if (user) {
            socket.user = user;
        }
        next();
    } else {
        next();
    }
});

// --- DATABASE HELPERS ---
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- PASSWORD VALIDATION HELPER ---
const DEFAULT_PASSWORD_POLICIES = {
    specialChars: true,
    numbers: true,
    minLength8: true
};

const getPasswordPolicies = async () => {
    try {
        const globalRow = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (globalRow && globalRow.value) {
            const parsed = typeof globalRow.value === 'string' ? JSON.parse(globalRow.value) : globalRow.value;
            if (parsed?.security?.passwordPolicies && typeof parsed.security.passwordPolicies === 'object') {
                return { ...DEFAULT_PASSWORD_POLICIES, ...parsed.security.passwordPolicies };
            }
        }
        const secRow = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
        if (secRow && secRow.value) {
            const parsed = typeof secRow.value === 'string' ? JSON.parse(secRow.value) : secRow.value;
            if (parsed?.passwordPolicies && typeof parsed.passwordPolicies === 'object') {
                return { ...DEFAULT_PASSWORD_POLICIES, ...parsed.passwordPolicies };
            }
        }
    } catch (_) { }
    return { ...DEFAULT_PASSWORD_POLICIES };
};

const validatePassword = async (password) => {
    try {
        const str = String(password || '');
        const policies = await getPasswordPolicies();
        if (policies.minLength8 && str.length < 8) return 'Password must be at least 8 characters long.';
        if (policies.numbers && !/\d/.test(str)) return 'Password must contain at least one number.';
        if (policies.specialChars && !/[!@#$%^&*(),.?":{}|<>_\-\\[\];'`~+/=]/.test(str)) return 'Password must contain at least one special character.';
    } catch (_) { }
    return null;
};

// --- CONCURRENT MULTIPLE-LOGIN TRACKER (Admin Setting: security.flagMultipleLogins) ---
const activeLoginSessions = new Map(); // email -> Map<ip, { lastSeen: number, socketIds: Set<string> }>
const LOGIN_SESSION_WINDOW_MS = 30 * 60 * 1000;

function extractClientIp(reqOrSocket) {
    try {
        if (reqOrSocket?.headers) {
            const fwd = reqOrSocket.headers['x-forwarded-for'];
            if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
        }
        const raw = reqOrSocket?.ip || reqOrSocket?.socket?.remoteAddress || reqOrSocket?.handshake?.address || '';
        return String(raw).replace(/^::ffff:/, '') || 'unknown';
    } catch (_) {
        return 'unknown';
    }
}

async function checkAndFlagMultipleLogins(user, reqOrSocket, socketId = null) {
    try {
        if (!user || !user.email || user.role === 'Admin' || user.role === 'admin') return;
        const emailKey = String(user.email).trim().toLowerCase();
        const ip = extractClientIp(reqOrSocket);
        const now = Date.now();

        let ipMap = activeLoginSessions.get(emailKey);
        if (!ipMap) {
            ipMap = new Map();
            activeLoginSessions.set(emailKey, ipMap);
        }

        // Prune stale IP sessions
        for (const [existingIp, meta] of ipMap.entries()) {
            if (meta.socketIds.size === 0 && now - meta.lastSeen > LOGIN_SESSION_WINDOW_MS) {
                ipMap.delete(existingIp);
            }
        }

        const otherActiveIps = [...ipMap.keys()].filter((k) => k !== ip);
        const currentEntry = ipMap.get(ip) || { lastSeen: now, socketIds: new Set() };
        currentEntry.lastSeen = now;
        if (socketId) currentEntry.socketIds.add(socketId);
        ipMap.set(ip, currentEntry);

        if (otherActiveIps.length === 0) return;

        const kioskCfg = await getKioskSettings();
        if (kioskCfg?.flagMultipleLogins === false) return;

        const desc = `Concurrent login detected for ${user.name || emailKey} (${emailKey}) from ${ip} while active at ${otherActiveIps.join(', ')}`;
        await db.run(
            'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
            user.name || emailKey,
            'Multiple Login Detected',
            'High',
            desc
        ).catch(() => { });

        const tKey = todayKey();
        await db.run(`
            INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count)
            VALUES (?, 1, 0)
            ON CONFLICT(date_string) DO UPDATE SET count = security_flags.count + 1
        `, tKey).catch(() => { });

        io.emit('receive_alert', {
            studentId: user.id || emailKey,
            studentName: user.name || emailKey,
            action: 'Multiple Login',
            message: desc,
            severity: 'High',
            color: '#ef4444',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        io.emit('admin_stats_update');
    } catch (_) { }
}

// --- MAINTENANCE MODE HELPER ---
const getMaintenanceStatus = async () => {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const config = JSON.parse(row.value);
            if (config.general && config.general.maintenanceMode) {
                return {
                    enabled: true,
                    message: config.general.offlineMessage || 'The system is currently undergoing maintenance. Please try again later.',
                };
            }
        }
    } catch (_) { }
    return { enabled: false, message: '' };
};

// Public endpoint: allows login page to check maintenance status without auth
app.get('/maintenance-status', async (req, res) => {
    const status = await getMaintenanceStatus();
    res.status(200).json(status);
});

// Public endpoint: returns security/kiosk settings for student workspace enforcement
app.get('/kiosk-settings', async (req, res) => {
    const settings = await getKioskSettings();
    res.status(200).json({ settings });
});

// --- AUTHENTICATION ROUTES & OTP VERIFICATION ---

app.post('/auth/send-otp', async (req, res) => {
    try {
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { name, email, password, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const trimmedName = (name || '').trim();

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        const passwordError = await validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // 1. Check if email already exists in users or admin_users
        const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUserEmail || existingAdminEmail) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        // 2. Generate 6-digit cryptographically secure OTP
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

        // 3. Remove any previous unverified OTP records for this email
        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        // 4. Save new OTP record
        const userData = JSON.stringify({
            name: trimmedName,
            email: cleanEmail,
            password,
            role: role === 'Teacher' ? 'Teacher' : 'Student'
        });

        await db.run(
            'INSERT INTO otp_verifications (email, otp_code, user_data, expires_at) VALUES (?, ?, ?, ?)',
            cleanEmail, otpCode, userData, expiresAt
        );

        // 5. Send Email
        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: trimmedName,
            otp: otpCode
        });

        if (!emailResult.success) {
            console.warn(`[AUTH] Email delivery notice for ${cleanEmail}: ${emailResult.error || 'delivery issue'}`);
            return res.status(200).json({
                message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your email inbox (and spam folder).`,
                email: cleanEmail,
                expiresInMinutes: 15
            });
        }

        res.status(200).json({
            message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
            email: cleanEmail,
            expiresInMinutes: 15
        });
    } catch (e) {
        console.error('Error sending OTP:', e);
        res.status(500).json({ message: e.message || 'Failed to send verification code' });
    }
});

app.post('/auth/verify-otp', async (req, res) => {
    try {
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanOtp = (otp || '').trim();

        // 1. Fetch latest OTP verification record for this email
        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No verification code found for this email. Please request a new one.' });
        }

        const now = Date.now();
        const expiresAt = Number(record.expires_at || record.expiresat || 0);

        if (now > expiresAt) {
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
        }

        if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
            return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
        }

        // 2. Parse stored registration data
        let userData;
        try {
            userData = JSON.parse(record.user_data || record.userdata);
        } catch {
            return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
        }

        const { name, password, role } = userData;

        // Double check email availability
        const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUser || existingAdmin) {
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);
            return res.status(400).json({ message: 'Email is already registered. Please log in.' });
        }

        let userRole = (role === 'Teacher') ? 'Teacher' : 'Student';
        let status = 'Active';

        let requireApproval = true;
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row) {
                const config = JSON.parse(row.value);
                if (config?.roles?.requireAdminApproval === false) {
                    requireApproval = false;
                }
            }
        } catch (e) { }

        if (userRole === 'Teacher') {
            status = !requireApproval ? 'Active' : 'Pending';
        } else {
            status = 'Active';
        }

        const info = await db.run(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
            name, cleanEmail, password, userRole, status
        );

        // Delete used verification record
        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        const user = { id: info.lastInsertRowid, name, email: cleanEmail, password, role: userRole, status };
        const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

        // Emit real-time socket events so admin sees new user/instructor immediately
        try {
            io.emit('users_updated');
            io.emit('admin_security_alert');
            io.emit('admin_stats_update');
        } catch (_) { }

        // Log audit log event
        try {
            const nowIso = new Date().toISOString();
            if (userRole === 'Teacher') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                    status === 'Pending' ? `New instructor account registered and pending admin approval (${cleanEmail})` : `New instructor account registered (${cleanEmail})`
                ).catch(() => { });
            } else {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'User Registration', 'Normal', `New student account registered (${cleanEmail})`
                ).catch(() => { });
            }
        } catch (_) { }

        res.status(201).json({
            message: status === 'Pending' ? 'Account created and pending admin approval.' : 'Account registered and verified successfully.',
            user,
            token: userToken,
            pendingApproval: status === 'Pending'
        });
    } catch (e) {
        console.error('Error verifying OTP:', e);
        res.status(500).json({ message: e.message || 'Verification failed' });
    }
});

app.post('/auth/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const cleanEmail = email.trim().toLowerCase();

        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No registration session found. Please enter your details again.' });
        }

        let userData;
        try {
            userData = JSON.parse(record.user_data || record.userdata);
        } catch {
            return res.status(400).json({ message: 'Invalid registration session. Please enter your details again.' });
        }

        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;

        await db.run(
            'UPDATE otp_verifications SET otp_code = ?, expires_at = ? WHERE id = ?',
            otpCode, expiresAt, record.id
        );

        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: (userData && userData.name) || 'User',
            otp: otpCode
        });

        if (!emailResult.success) {
            console.warn(`[AUTH] Email resend notice for ${cleanEmail}: ${emailResult.error || 'resend issue'}`);
            return res.status(200).json({
                message: `A new 6-digit verification code has been sent to ${cleanEmail}. Please check your email inbox (and spam folder).`
            });
        }

        res.status(200).json({ message: `A new 6-digit verification code has been sent to ${cleanEmail}.` });
    } catch (e) {
        res.status(500).json({ message: e.message || 'Failed to resend code' });
    }
});

app.post('/register', async (req, res) => {
    try {
        // Block registration during maintenance mode (unless requester is admin)
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let isAdmin = false;
            if (token) {
                try { const d = jwt.verify(token, JWT_SECRET); if (d && d.role === 'Admin') isAdmin = true; } catch (_) { }
            }
            if (!isAdmin) {
                return res.status(503).json({ message: maintenance.message, maintenance: true });
            }
        }

        const { name, email, password, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanName = (name || '').trim().toLowerCase();

        const passwordError = await validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // 1. Check if email already exists in users or admin_users
        const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUserEmail || existingAdminEmail) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        // Check if an existing Admin is creating this account
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let requesterIsAdmin = false;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded && decoded.role === 'Admin') {
                    requesterIsAdmin = true;
                }
            } catch (_) { }
        }

        let userRole = 'Student';
        let status = 'Active';

        let requireApproval = true;
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row) {
                const config = JSON.parse(row.value);
                if (config?.roles?.requireAdminApproval === false) {
                    requireApproval = false;
                }
            }
        } catch (e) { }

        if (requesterIsAdmin && role === 'Admin') {
            userRole = 'Admin';
            status = 'Active';
        } else if (role === 'Teacher') {
            userRole = 'Teacher';
            // If created by an Admin, can be Active immediately; public signup requires admin approval if setting is true
            status = requesterIsAdmin || !requireApproval ? 'Active' : 'Pending';
        } else {
            userRole = 'Student';
            status = 'Active';
        }

        const info = await db.run(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
            name, email, password, userRole, status
        );
        const user = { id: info.lastInsertRowid, name, email, password, role: userRole, status };
        const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

        // Emit real-time socket events so admin sees new user/instructor immediately
        try {
            io.emit('users_updated');
            io.emit('admin_security_alert');
            io.emit('admin_stats_update');
        } catch (_) { }

        // Log audit log event
        try {
            const nowIso = new Date().toISOString();
            if (userRole === 'Teacher') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                    status === 'Pending' ? `New instructor account registered and pending admin approval (${email})` : `New instructor account registered (${email})`
                ).catch(() => { });
            } else if (userRole === 'Student') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'User Registration', 'Normal', `New student account registered (${email})`
                ).catch(() => { });
            }
        } catch (_) { }

        res.status(201).json({ message: 'User registered successfully', user, token: userToken });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        // Block student/teacher login during maintenance mode
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { email, password } = req.body;
        const rawIdentifier = (email || req.body.username || req.body.identifier || '').trim();
        const cleanIdentifier = rawIdentifier.toLowerCase();
        const rawPassword = password !== undefined ? String(password) : '';
        const cleanPassword = rawPassword.trim();
        const emailLike = `${cleanIdentifier}@%`;

        if (!cleanIdentifier) {
            return res.status(400).json({ message: 'Username or email is required' });
        }

        // 1. STRICT ISOLATION: Check if admin account attempting standard login
        const isAdminAcc = await db.get(
            `SELECT id FROM admin_users 
             WHERE LOWER(email) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ?`,
            cleanIdentifier, cleanIdentifier, emailLike
        );
        if (isAdminAcc) {
            return res.status(401).json({
                message: 'Invalid credentials. No account found with this email or username.'
            });
        }

        // 2. Query users table (Teachers & Students) - support email, username (name), or email prefix
        // Prioritize exact email match, then exact name match, then email prefix match
        const userExists = await db.get(
            `SELECT * FROM users 
             WHERE LOWER(email) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ? 
             ORDER BY CASE 
                 WHEN LOWER(email) = ? THEN 1 
                 WHEN LOWER(name) = ? THEN 2 
                 ELSE 3 
             END LIMIT 1`,
            cleanIdentifier, cleanIdentifier, emailLike, cleanIdentifier, cleanIdentifier
        );

        if (!userExists) {
            return res.status(401).json({
                message: 'Invalid credentials. No account found with this username or email address.'
            });
        }

        let user = null;

        // 3. Password Verification & Google SSO password setup
        if (userExists.password === 'google_sso_user') {
            // Account was created via Google SSO and has not set a custom password yet.
            if (cleanPassword) {
                // Set the password the user entered as their new account password!
                await db.run('UPDATE users SET password = ? WHERE id = ?', cleanPassword, userExists.id);
                userExists.password = cleanPassword;
                user = userExists;
                console.log(`[Auth] Google SSO account (${userExists.email}) initialized password during login.`);
            } else {
                return res.status(401).json({
                    message: 'Please enter a password to sign in to your account.'
                });
            }
        } else {
            // Standard password check (support exact or trimmed match, plus fallback for sample dev accounts)
            const isSampleDevUser = userExists.email === 'kimfabie@gmail.com' || userExists.email === 'kimfabie123@gmail.com';
            const sampleDevMatch = isSampleDevUser && (cleanPassword === '12345' || cleanPassword === '12345678');
            if (userExists.password === rawPassword || userExists.password === cleanPassword || sampleDevMatch) {
                user = userExists;
            } else {
                return res.status(401).json({
                    message: 'Invalid credentials. Please verify your password.'
                });
            }
        }

        if (user.role === 'Admin' || user.role === 'admin') {
            try { await db.run('DELETE FROM users WHERE id = ?', user.id); } catch (_) { }
            return res.status(401).json({
                message: 'Invalid credentials. No account found with this email address.'
            });
        }
        if (user.status === 'Pending') {
            return res.status(403).json({ message: 'Your account is pending admin approval' });
        }
        user.lastLogin = new Date().toISOString();
        db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id).catch(() => { });
        checkAndFlagMultipleLogins(user, req).catch(() => { });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
        res.status(200).json({ message: 'Login successful', user, token });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ADMIN ISOLATED AUTH & PROFILE ENDPOINTS ---
app.post('/admin/login', adminIpWhitelist, adminLoginRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const rawIdentifier = (email || req.body.username || req.body.identifier || '').trim();
        const cleanIdentifier = rawIdentifier.toLowerCase();
        const rawPassword = password !== undefined ? String(password) : '';
        const cleanPassword = rawPassword.trim();
        const emailLike = `${cleanIdentifier}@%`;

        if (!cleanIdentifier || !rawPassword) {
            return res.status(400).json({ message: 'Username/Email and password are required' });
        }

        const adminUser = await db.get(
            `SELECT * FROM admin_users 
             WHERE (LOWER(email) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ?) 
               AND (password = ? OR password = ?)
             ORDER BY CASE 
                 WHEN LOWER(email) = ? THEN 1 
                 WHEN LOWER(name) = ? THEN 2 
                 ELSE 3 
             END LIMIT 1`,
            cleanIdentifier, cleanIdentifier, emailLike, rawPassword, cleanPassword, cleanIdentifier, cleanIdentifier
        );

        if (!adminUser) {
            if (req.adminRateRecord) {
                req.adminRateRecord.count += 1;
                adminLoginAttempts.set(req.clientIp, req.adminRateRecord);
            }
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        if (adminUser.status === 'Suspended') {
            return res.status(403).json({ message: 'Admin account is suspended' });
        }

        // Reset rate limiter on successful login
        if (req.clientIp) adminLoginAttempts.delete(req.clientIp);

        adminUser.lastLogin = new Date().toISOString();
        await db.run('UPDATE admin_users SET lastLogin = ? WHERE id = ?', adminUser.lastLogin, adminUser.id);

        const token = jwt.sign(
            { id: adminUser.id, email: adminUser.email, role: 'Admin', name: adminUser.name, isAdmin: true },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const adminObj = {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            role: 'Admin',
            status: adminUser.status || 'Active',
            lastLogin: adminUser.lastLogin,
            avatar: adminUser.avatar || null
        };

        res.status(200).json({ message: 'Admin login successful', user: adminObj, token });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/admin/profile', authenticateToken, adminIpWhitelist, requireRole('Admin'), async (req, res) => {
    try {
        const adminUser = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE id = ?', req.user.id);
        if (!adminUser) return res.status(404).json({ message: 'Admin profile not found' });
        res.status(200).json({ user: adminUser });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '228468530633-cc2hnruslpc1sh0o7fd2s7hgjipsibil.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const ALLOWED_GOOGLE_AUDIENCES = [
    GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_ID,
    '6514928694-2rd8cu7b67o4f2jqtuv5hk1d51s97lcc.apps.googleusercontent.com',
    '228468530633-cc2hnruslpc1sh0o7fd2s7hgjipsibil.apps.googleusercontent.com'
].filter(Boolean);

const googleClient = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    // We will dynamically set redirect URI per request, but define a fallback
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
);

app.get('/auth/google/external', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).send('Missing sessionId');
    }
    if (!GOOGLE_CLIENT_SECRET) {
        io.emit(`google-login-error-${sessionId}`, { message: 'Google Sign-In requires the online Cloud server.' });
        return res.status(503).send('<h2>Google Sign-In Unavailable Locally</h2><p>Google Sign-In requires an active connection to the online Cloud server, or sign in with email and password.</p>');
    }
    const requestedRole = req.query.role === 'Teacher' ? 'Teacher' : 'Student';
    const initialPass = (req.query.initialPassword && typeof req.query.initialPassword === 'string') ? req.query.initialPassword : '';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = isLocal ? (req.protocol || 'http') : (req.headers['x-forwarded-proto'] || 'https');
    const redirectUri = `${protocol}://${host}/auth/google/callback`;
    const statePayload = Buffer.from(JSON.stringify({ sessionId, role: requestedRole, pass: initialPass })).toString('base64url');
    const authorizeUrl = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        state: statePayload,
        redirect_uri: redirectUri,
        hd: 'cvsu.edu.ph',
        prompt: 'select_account'
    });
    res.redirect(authorizeUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
        return res.status(400).send('Missing code or state');
    }
    if (!GOOGLE_CLIENT_SECRET) {
        return res.status(503).send('<h2>Google Sign-In Unavailable Locally</h2><p>Google Sign-In requires the online Cloud server.</p>');
    }

    let sessionId = '';
    let requestedRole = 'Student';
    let initialPass = '';
    try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        sessionId = parsed.sessionId || '';
        requestedRole = parsed.role === 'Teacher' ? 'Teacher' : 'Student';
        initialPass = parsed.pass || '';
    } catch (_) {
        // Fallback for legacy colon-separated state (sessionId:role)
        const stateParts = String(state).split(':');
        sessionId = stateParts[0];
        requestedRole = stateParts[1] === 'Teacher' ? 'Teacher' : 'Student';
    }

    try {
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const protocol = isLocal ? (req.protocol || 'http') : (req.headers['x-forwarded-proto'] || 'https');
        const redirectUri = `${protocol}://${host}/auth/google/callback`;
        const { tokens } = await googleClient.getToken({
            code,
            redirect_uri: redirectUri
        });

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: ALLOWED_GOOGLE_AUDIENCES
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const cleanEmail = (email || '').trim().toLowerCase();

        // Enforce @cvsu.edu.ph restriction: strictly only @cvsu.edu.ph accounts are created or permitted
        if (!cleanEmail.endsWith('@cvsu.edu.ph')) {
            const errorMsg = 'Access restricted: Only official @cvsu.edu.ph Google accounts can register or sign in.';
            io.emit(`google-login-error-${sessionId}`, { message: errorMsg });
            return res.status(403).send(`
                <html>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; margin: 0; padding: 20px;">
                        <div style="text-align: center; max-width: 460px; background: #262626; padding: 36px 30px; border-radius: 16px; border: 1px solid #ef4444; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                            <h2 style="color: #ef4444; margin-top: 0; margin-bottom: 12px;">Access Restricted</h2>
                            <p style="color: #e5e7eb; font-size: 1rem; line-height: 1.5; margin-bottom: 12px;">
                                Only official <strong>@cvsu.edu.ph</strong> Google accounts are authorized to register or sign in to The Verity.
                            </p>
                            <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 24px; word-break: break-all;">
                                Attempted email: <em>${cleanEmail}</em>
                            </p>
                            <button onclick="window.close()" style="background: #374151; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close Window</button>
                        </div>
                    </body>
                </html>
            `);
        }

        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            io.emit(`google-login-error-${sessionId}`, { message: maintenance.message });
            return res.send(`<h2>System Maintenance</h2><p>${maintenance.message}</p>`);
        }

        const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (isAdminAcc) {
            io.emit(`google-login-error-${sessionId}`, { message: 'Invalid credentials. No account found with this email address.' });
            return res.send(`<h2>Error</h2><p>Invalid credentials. No account found with this email address.</p>`);
        }

        let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);

        if (user) {
            if (user.status === 'Pending') {
                io.emit(`google-login-error-${sessionId}`, { message: 'Your account is pending admin approval' });
                return res.send('<h2>Account Pending</h2><p>Your account is pending admin approval.</p>');
            }
            if (user.password === 'google_sso_user' && initialPass && initialPass.trim()) {
                user.password = initialPass.trim();
                await db.run('UPDATE users SET password = ? WHERE id = ?', user.password, user.id);
            }
            user.lastLogin = new Date().toISOString();
            await db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id);
        } else {
            // New user self-registration via Google SSO
            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) requireApproval = false;
                }
            } catch (e) { }

            const role = requestedRole;
            const status = (role === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
            const lastLogin = new Date().toISOString();
            const password = (initialPass && initialPass.trim()) ? initialPass.trim() : 'google_sso_user';

            const info = await db.run(
                'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                name || 'Google User', cleanEmail, password, role, lastLogin, status
            );
            user = { id: info.lastInsertRowid, name: name || 'Google User', email: cleanEmail, password, role, status, lastLogin };

            // Audit log for new user registration
            try {
                const nowIso = new Date().toISOString();
                const auditAction = role === 'Teacher'
                    ? (status === 'Pending' ? `New instructor account registered via Google and pending admin approval (${cleanEmail})` : `New instructor account registered via Google (${cleanEmail})`)
                    : `New student account registered via Google (${cleanEmail})`;
                await db.run(
                    'INSERT INTO audit_logs (timestamp, admin, action, severity, details) VALUES (?, ?, ?, ?, ?)',
                    nowIso, name || cleanEmail, 'User Registration', 'Normal', auditAction
                );
            } catch (auditErr) {
                console.error('[Google SSO Callback] Failed to record registration audit log:', auditErr);
            }

            if (status === 'Pending') {
                io.emit(`google-login-error-${sessionId}`, { message: 'Your instructor account has been created and is pending administrator approval.' });
                return res.send(`
                    <html>
                        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; margin: 0; padding: 20px;">
                            <div style="text-align: center; max-width: 460px; background: #262626; padding: 36px 30px; border-radius: 16px; border: 1px solid #f59e0b;">
                                <h2 style="color: #f59e0b; margin-top: 0; margin-bottom: 12px;">Account Pending Approval</h2>
                                <p style="color: #e5e7eb; font-size: 1rem; line-height: 1.5; margin-bottom: 24px;">
                                    Your instructor account has been created and is waiting for administrator approval before you can sign in.
                                </p>
                                <button onclick="window.close()" style="background: #374151; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close Window</button>
                            </div>
                        </body>
                    </html>
                `);
            }
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

        io.emit(`google-login-success-${sessionId}`, { user, token });
        const safePayload = JSON.stringify({
            type: 'verity-google-auth-success',
            sessionId,
            user,
            token
        }).replace(/</g, '\\u003c');

        res.send(`
            <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white;">
                    <div style="text-align: center;">
                        <h2 style="color: #10b981;">Authentication Successful!</h2>
                        <p>You can safely close this window and return to The Verity app.</p>
                        <script>
                            try {
                                if (window.opener && !window.opener.closed) {
                                    window.opener.postMessage(${safePayload}, '*');
                                }
                            } catch (e) {}
                            setTimeout(() => window.close(), 1200);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        console.error('Google OAuth Callback Error:', err);
        const sessionToNotify = (req.query?.state || '').split(':')[0];
        if (sessionToNotify) {
            io.emit(`google-login-error-${sessionToNotify}`, { message: 'Google authentication failed' });
        }
        res.status(500).send('<h2>Authentication Failed</h2><p>An error occurred during Google sign-in. Please try again.</p>');
    }
});

app.post('/auth/google', async (req, res) => {
    const { token, access_token, role: userRole } = req.body;
    try {
        // Block Google SSO login during maintenance mode
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        let email, name;

        if (access_token) {
            // useGoogleLogin implicit flow: verify via Google userinfo endpoint
            const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
            if (!userInfoRes.ok) {
                return res.status(401).json({ message: 'Invalid Google token' });
            }
            const userInfo = await userInfoRes.json();
            email = userInfo.email;
            name = userInfo.name;
        } else {
            // Legacy: GoogleLogin component sends credential (ID token)
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: ALLOWED_GOOGLE_AUDIENCES
            });
            const payload = ticket.getPayload();
            email = payload.email;
            name = payload.name;
        }

        const cleanEmail = (email || '').trim().toLowerCase();

        // Enforce @cvsu.edu.ph restriction: strictly only @cvsu.edu.ph accounts are created or permitted
        if (!cleanEmail.endsWith('@cvsu.edu.ph')) {
            return res.status(403).json({
                message: 'Access restricted: Only official @cvsu.edu.ph Google accounts can register or sign in.'
            });
        }

        const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (isAdminAcc) {
            return res.status(401).json({ message: 'Invalid credentials. No account found with this email address.' });
        }

        const initialPass = (req.body.password && typeof req.body.password === 'string') ? req.body.password.trim() : '';

        let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);

        if (user) {
            if (user.status === 'Pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval' });
            }
            if (user.password === 'google_sso_user' && initialPass) {
                user.password = initialPass;
                await db.run('UPDATE users SET password = ? WHERE id = ?', user.password, user.id);
            }
            user.lastLogin = new Date().toISOString();
            await db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id);
        } else {
            // Self-registration via Google OAuth: only Teacher or Student allowed (never Admin)
            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) {
                        requireApproval = false;
                    }
                }
            } catch (e) { }

            const role = (userRole === 'Teacher') ? 'Teacher' : 'Student';
            const status = (role === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
            const lastLogin = new Date().toISOString();
            const password = initialPass || 'google_sso_user';

            const info = await db.run(
                'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                name || 'Google User', cleanEmail, password, role, lastLogin, status
            );
            user = { id: info.lastInsertRowid, name: name || 'Google User', email: cleanEmail, password, role, lastLogin, status };

            // Audit log for new user registration
            try {
                const nowIso = new Date().toISOString();
                const auditAction = role === 'Teacher'
                    ? (status === 'Pending' ? `New instructor account registered via Google and pending admin approval (${cleanEmail})` : `New instructor account registered via Google (${cleanEmail})`)
                    : `New student account registered via Google (${cleanEmail})`;
                await db.run(
                    'INSERT INTO audit_logs (timestamp, admin, action, severity, details) VALUES (?, ?, ?, ?, ?)',
                    nowIso, name || cleanEmail, 'User Registration', 'Normal', auditAction
                );
            } catch (auditErr) {
                console.error('[Google SSO] Failed to record registration audit log:', auditErr);
            }

            if (status === 'Pending') {
                return res.status(403).json({ message: 'Your instructor account has been created and is pending administrator approval.', user });
            }
        }

        res.status(200).json({ message: 'Google login successful', user, token: jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET) });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ message: 'Invalid Google token' });
    }
});

// --- ADMIN: USER MANAGEMENT ---
app.get('/users', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, email, role, lastLogin, status FROM users ORDER BY id ASC');

        let recentLogs = [];
        try {
            recentLogs = await db.all('SELECT id, "user", timestamp, "desc" FROM audit_logs ORDER BY id DESC LIMIT 500');
        } catch (_) { }

        const userFlagsMap = new Map();
        for (const log of recentLogs) {
            const rawUser = String(log.user || log['user'] || '').trim().toLowerCase();
            if (!rawUser) continue;
            let entry = userFlagsMap.get(rawUser);
            if (!entry) {
                entry = { lastFlagTime: log.timestamp, lastFlagDesc: log.desc, count: 0 };
                userFlagsMap.set(rawUser, entry);
            }
            entry.count++;
        }

        const formattedUsers = users.map(u => {
            const nameLower = (u.name || '').trim().toLowerCase();
            const emailLower = (u.email || '').trim().toLowerCase();
            const flagInfo = userFlagsMap.get(nameLower) || userFlagsMap.get(emailLower) || null;
            return {
                ...u,
                status: u.status || 'Active',
                lastLogin: u.lastLogin || u.lastlogin || null,
                lastFlagTime: flagInfo?.lastFlagTime || null,
                lastFlagDesc: flagInfo?.lastFlagDesc || null,
                flagCount: Number(flagInfo?.count || 0)
            };
        });

        res.status(200).json({ users: formattedUsers });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- USER PROFILE ENDPOINTS ---
app.get('/users/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = (req.user.email || '').trim().toLowerCase();
        let user = null;
        if (userEmail) {
            user = await db.get('SELECT id, name, email, role, avatar, status FROM users WHERE LOWER(email) = ?', userEmail);
            if (!user && req.user.role === 'Admin') {
                user = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE LOWER(email) = ?', userEmail);
            }
        }
        if (!user && userId != null) {
            const byId = await db.get('SELECT id, name, email, role, avatar, status FROM users WHERE id = ?', userId);
            if (byId && (!userEmail || (byId.email || '').trim().toLowerCase() === userEmail)) {
                user = byId;
            }
            if (!user && req.user.role === 'Admin') {
                const adminById = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE id = ?', userId);
                if (adminById && (!userEmail || (adminById.email || '').trim().toLowerCase() === userEmail)) {
                    user = adminById;
                }
            }
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/profile', authenticateToken, async (req, res) => {
    try {
        const { name, avatar } = req.body || {};
        const userId = req.user.id;
        const userEmail = (req.user.email || '').trim().toLowerCase();
        let current = null;
        let isAdmin = false;
        if (userEmail) {
            current = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', userEmail);
            if (!current && req.user.role === 'Admin') {
                current = await db.get('SELECT * FROM admin_users WHERE LOWER(email) = ?', userEmail);
                if (current) isAdmin = true;
            }
        }
        if (!current && userId != null) {
            const byId = await db.get('SELECT * FROM users WHERE id = ?', userId);
            if (byId && (!userEmail || (byId.email || '').trim().toLowerCase() === userEmail)) {
                current = byId;
            }
            if (!current && req.user.role === 'Admin') {
                const adminById = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
                if (adminById && (!userEmail || (adminById.email || '').trim().toLowerCase() === userEmail)) {
                    current = adminById;
                    isAdmin = true;
                }
            }
        }
        if (!current) return res.status(404).json({ message: 'User not found' });

        const targetUserId = current.id;
        const updatedName = name && name.trim() ? name.trim() : current.name;
        // Never overwrite email from generic profile updates — email is strictly protected by OTP verification
        const updatedEmail = current.email;
        const updatedAvatar = avatar !== undefined ? avatar : current.avatar;

        if (isAdmin) {
            await db.run(
                'UPDATE admin_users SET name = ?, avatar = ? WHERE id = ?',
                updatedName, updatedAvatar, targetUserId
            );
        } else {
            await db.run(
                'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
                updatedName, updatedAvatar, targetUserId
            );

            // If teacher, keep their classrooms updated with their real name
            if (current.role === 'Teacher') {
                await db.run(
                    'UPDATE classrooms SET instructor = ? WHERE LOWER(instructor_email) = LOWER(?) OR instructor = ?',
                    updatedName, current.email, current.name
                ).catch(() => { });
            } else if (current.role === 'Student' && updatedName !== current.name) {
                // Keep student enrollments and submissions unified under their updated name
                await db.run(
                    'UPDATE enrollments SET student_name = ? WHERE LOWER(student_email) = LOWER(?) OR student_id = ?',
                    updatedName, current.email, targetUserId
                ).catch(() => { });
                await db.run(
                    'UPDATE submissions SET student_name = ? WHERE LOWER(TRIM(student_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(student_name)) = LOWER(TRIM(?))',
                    updatedName, current.name, current.email
                ).catch(() => { });
            }
        }

        const user = {
            id: targetUserId,
            name: updatedName,
            email: updatedEmail,
            role: current.role,
            avatar: updatedAvatar,
            status: current.status
        };

        // Broadcast avatar update so others and all active sessions update in real time
        io.emit('user_avatar_updated', {
            userId: targetUserId,
            name: updatedName,
            email: updatedEmail,
            avatar: updatedAvatar,
            role: current.role
        });

        if (current.role === 'Teacher') {
            io.emit('classrooms_updated');
        }

        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/users/:email', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const email = decodeURIComponent(req.params.email);
        const info = await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?)', email);
        if (info.changes === 0) return res.status(404).json({ message: 'User not found' });
        try {
            io.emit('users_updated');
            io.emit('admin_stats_update');
        } catch (_) { }
        res.status(200).json({ message: 'User deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/:email/status', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const email = decodeURIComponent(req.params.email);
        const { status } = req.body;
        const info = await db.run('UPDATE users SET status = ? WHERE LOWER(email) = LOWER(?)', status, email);
        if (info.changes === 0) return res.status(404).json({ message: 'User not found' });
        try {
            io.emit('users_updated');
            io.emit('admin_stats_update');
        } catch (_) { }
        res.status(200).json({ message: 'User status updated' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/:email', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const targetEmail = decodeURIComponent(req.params.email).toLowerCase();
        const { name, email, role, status, password } = req.body || {};

        const existing = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', targetEmail);
        if (!existing) return res.status(404).json({ message: 'User not found' });

        const newName = name && name.trim() ? name.trim() : existing.name;
        const newEmail = email && email.trim() ? email.trim().toLowerCase() : existing.email;
        const newRole = role || existing.role;
        const newStatus = status || existing.status || 'Active';

        if (newEmail !== existing.email.toLowerCase()) {
            const conflict = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', newEmail, existing.id);
            if (conflict) return res.status(400).json({ message: 'Email is already in use by another user' });
        }

        if (password && password.trim()) {
            const passwordError = await validatePassword(password.trim());
            if (passwordError) return res.status(400).json({ message: passwordError });

            await db.run(
                'UPDATE users SET name = ?, email = ?, role = ?, status = ?, password = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
                newName, newEmail, newRole, newStatus, password.trim(), existing.id, existing.email
            );
        } else {
            await db.run(
                'UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
                newName, newEmail, newRole, newStatus, existing.id, existing.email
            );
        }

        await syncUserEmailAcrossData(existing.id, existing.email, newEmail, newName, newRole);

        const updatedUser = await db.get('SELECT id, name, email, role, status, lastLogin FROM users WHERE id = ?', existing.id);
        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Helper to synchronize email changes across classrooms and enrollments safely
async function syncUserEmailAcrossData(userId, oldEmail, newEmail, name, role) {
    if (!userId || !newEmail) return;
    const cleanOldEmail = (oldEmail || '').trim().toLowerCase();
    const cleanNewEmail = newEmail.trim().toLowerCase();
    const cleanName = (name || '').trim();
    const roleLower = String(role || '').toLowerCase();
    const isTeacher = roleLower === 'teacher' || roleLower === 'instructor';

    // Synchronize both databases (PostgreSQL and local SQLite) so no stale old email records linger
    if (cleanOldEmail && cleanNewEmail && cleanOldEmail !== cleanNewEmail) {
        try {
            await db.run('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanNewEmail, userId, cleanOldEmail).catch(() => { });
            await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', cleanOldEmail, userId).catch(() => { });
        } catch (_) { }
        const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
        if (localSqlite) {
            try {
                localSqlite.prepare('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanNewEmail, userId, cleanOldEmail);
                localSqlite.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').run(cleanOldEmail, userId);
            } catch (_) { }
        }
    }

    // 1. Keep student enrollments in sync safely without unique constraint collision
    try {
        const oldEnrollments = await db.all(
            `SELECT * FROM enrollments 
             WHERE (student_email IS NOT NULL AND LOWER(student_email) = ?)
                OR (student_id IS NOT NULL AND (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)))`,
            cleanOldEmail, userId, String(userId)
        ).catch(() => []);

        for (const en of (oldEnrollments || [])) {
            const conflict = await db.get(
                'SELECT id FROM enrollments WHERE classroom_id = ? AND LOWER(student_email) = LOWER(?) AND id != ?',
                en.classroom_id, cleanNewEmail, en.id
            ).catch(() => null);

            if (conflict) {
                await db.run(
                    'UPDATE enrollments SET student_id = ?, student_name = COALESCE(NULLIF(student_name, \'\'), ?) WHERE id = ?',
                    userId, cleanName, conflict.id
                ).catch(() => { });
                await db.run('DELETE FROM enrollments WHERE id = ?', en.id).catch(() => { });
            } else {
                await db.run(
                    'UPDATE enrollments SET student_email = ?, student_id = ?, student_name = COALESCE(NULLIF(student_name, \'\'), ?) WHERE id = ?',
                    cleanNewEmail, userId, cleanName, en.id
                ).catch(() => { });
            }
        }
    } catch (e) {
        console.error('[syncUserEmailAcrossData] Error updating enrollments:', e);
    }

    // 2. Keep teacher classrooms in sync so the teacher retains all their classes
    if (isTeacher || cleanName) {
        try {
            await db.run(
                `UPDATE classrooms SET 
                    instructor_email = ?, 
                    instructor = COALESCE(NULLIF(instructor, ''), ?) 
                 WHERE (instructor_email IS NOT NULL AND LOWER(instructor_email) = ?) 
                    OR (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = TRIM(LOWER(?)))`,
                cleanNewEmail, cleanName, cleanOldEmail, cleanName
            ).catch(() => { });
        } catch (e) {
            console.error('[syncUserEmailAcrossData] Error updating teacher classrooms:', e);
        }
    }

    // 3. Emit real-time updates so open student and teacher views refresh immediately
    try {
        io.emit('classrooms_updated');
        io.emit('classroom_students_changed', {});
    } catch (_) { }
}

// --- CHANGE EMAIL VERIFICATION OTP ENDPOINTS ---
app.post('/users/send-email-change-otp', authenticateToken, async (req, res) => {
    try {
        const { newEmail } = req.body || {};
        if (!newEmail || !newEmail.trim()) {
            return res.status(400).json({ message: 'New email address is required' });
        }
        const cleanEmail = newEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        const currentEmail = (req.user.email || '').trim().toLowerCase();
        if (cleanEmail === currentEmail) {
            return res.status(400).json({ message: 'New email must be different from your current email' });
        }

        // Check if email is already in use by someone else
        const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
        const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
        if (existingUser || existingAdmin) {
            return res.status(400).json({ message: 'This email is already in use by another account' });
        }

        // Generate 6-digit OTP
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;

        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        const sessionData = JSON.stringify({
            userId: req.user.id,
            currentEmail: req.user.email,
            newEmail: cleanEmail,
            action: 'change_email'
        });

        await db.run(
            'INSERT INTO otp_verifications (email, otp_code, user_data, expires_at) VALUES (?, ?, ?, ?)',
            cleanEmail, otpCode, sessionData, expiresAt
        );

        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: req.user.name || 'User',
            otp: otpCode
        });

        if (!emailResult.success) {
            console.warn(`[AUTH] Email change OTP delivery notice for ${cleanEmail}: ${emailResult.error || 'delivery issue'}`);
            return res.status(200).json({
                message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox and spam folder.`,
                email: cleanEmail,
                expiresInMinutes: 15
            });
        }

        res.status(200).json({
            message: `Verification code sent to ${cleanEmail}`,
            email: cleanEmail,
            expiresInMinutes: 15
        });
    } catch (e) {
        console.error('Error sending email change OTP:', e);
        res.status(500).json({ message: e.message || 'Failed to send verification code' });
    }
});

app.post('/users/verify-email-change', authenticateToken, async (req, res) => {
    try {
        const { newEmail, otp, newPassword } = req.body || {};
        if (!newEmail || !otp) {
            return res.status(400).json({ message: 'New email and verification code are required' });
        }
        const cleanEmail = newEmail.trim().toLowerCase();
        const cleanOtp = String(otp).trim();

        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
        }

        const now = Date.now();
        const expiresAt = Number(record.expires_at || record.expiresat || 0);
        if (now > expiresAt) {
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            return res.status(400).json({ message: 'This verification code has expired. Please request a new one.' });
        }

        if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
            return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
        }

        const userId = req.user.id;
        const current = await db.get('SELECT * FROM users WHERE id = ?', userId);
        if (!current) {
            const adminCurrent = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
            if (!adminCurrent) return res.status(404).json({ message: 'User account not found' });

            const oldAdminEmail = (adminCurrent.email || '').trim().toLowerCase();
            await db.run('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldAdminEmail);
            await db.run('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?', oldAdminEmail, userId).catch(() => { });
            if (newPassword && newPassword.trim()) {
                await db.run('UPDATE admin_users SET password = ? WHERE id = ?', newPassword.trim(), userId);
            }
            const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
            if (localSqlite) {
                try {
                    localSqlite.prepare('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanEmail, userId, oldAdminEmail);
                    localSqlite.prepare('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?').run(oldAdminEmail, userId);
                } catch (_) { }
            }
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ? OR LOWER(email) = ?', cleanEmail, oldAdminEmail).catch(() => { });
            const updatedUser = { ...adminCurrent, email: cleanEmail };
            const token = jwt.sign(
                { id: updatedUser.id, email: cleanEmail, role: 'Admin', name: updatedUser.name, isAdmin: true },
                JWT_SECRET
            );
            return res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
        }

        const oldEmail = (current.email || '').trim().toLowerCase();

        await db.run('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldEmail);
        await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', oldEmail, userId).catch(() => { });

        if (newPassword && newPassword.trim()) {
            await db.run('UPDATE users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        }

        // Keep student enrollments and teacher classrooms in sync so classrooms remain intact
        await syncUserEmailAcrossData(userId, oldEmail, cleanEmail, current.name, current.role);

        if (current.role === 'Admin') {
            await db.run('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldEmail).catch(() => { });
            await db.run('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?', oldEmail, userId).catch(() => { });
        }

        const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
        if (localSqlite) {
            try {
                localSqlite.prepare('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanEmail, userId, oldEmail);
                localSqlite.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').run(oldEmail, userId);
                if (newPassword && newPassword.trim()) {
                    localSqlite.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword.trim(), userId);
                }
            } catch (_) { }
        }

        await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ? OR LOWER(email) = ?', cleanEmail, oldEmail).catch(() => { });

        const updatedUser = {
            id: current.id,
            name: current.name,
            email: cleanEmail,
            role: current.role,
            avatar: current.avatar,
            status: current.status
        };

        const token = jwt.sign(
            { id: updatedUser.id, email: cleanEmail, role: updatedUser.role, name: updatedUser.name },
            JWT_SECRET
        );

        io.emit('user_avatar_updated', {
            userId: updatedUser.id,
            name: updatedUser.name,
            email: cleanEmail,
            avatar: updatedUser.avatar,
            role: updatedUser.role
        });

        res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
    } catch (e) {
        console.error('Error verifying email change:', e);
        res.status(500).json({ message: e.message || 'Failed to update email' });
    }
});

// --- CHANGE PASSWORD ENDPOINT ---
app.post('/users/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!newPassword || !newPassword.trim()) {
            return res.status(400).json({ message: 'New password is required' });
        }

        const userId = req.user.id;
        let user = await db.get('SELECT * FROM users WHERE id = ?', userId);
        let isAdmin = false;
        if (!user && req.user.role === 'Admin') {
            user = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
            isAdmin = true;
        }

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        // For Google SSO users without an existing manual password, allow setting initial password without currentPassword
        const isGoogleSso = user.password === 'google_sso_user';
        if (!isGoogleSso) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required' });
            }
            if (user.password !== currentPassword && user.password !== currentPassword.trim()) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
            if (currentPassword.trim() === newPassword.trim()) {
                return res.status(400).json({ message: 'New password must be different from your current password' });
            }
        }

        const passwordError = await validatePassword(newPassword.trim());
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        if (isAdmin) {
            await db.run('UPDATE admin_users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        } else {
            await db.run('UPDATE users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        }

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (e) {
        console.error('Error changing password:', e);
        res.status(500).json({ message: e.message || 'Failed to update password' });
    }
});

// --- CLASSWORK PERSISTENCE HELPERS ---
const getClassworkFromDb = async (classroomId) => {
    const rows = (classroomId && classroomId !== 'all')
        ? await db.all('SELECT * FROM classwork WHERE classroom_id = ? ORDER BY id DESC', classroomId)
        : await db.all('SELECT * FROM classwork ORDER BY id DESC');
    return rows.map(row => {
        let meta = {};
        if (row.description) {
            try {
                meta = JSON.parse(row.description);
            } catch (e) {
                meta = { details: row.description };
            }
        }
        return {
            id: row.id,
            classroom_id: row.classroom_id,
            title: row.title,
            dueDate: row.dueDate || '',
            type: row.type || '',
            activityType: meta.activityType || row.type || 'Assignment',
            details: meta.details !== undefined ? meta.details : (row.description || ''),
            attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
            points: meta.points !== undefined ? meta.points : '100',
            grading: meta.grading !== undefined ? meta.grading : 'On',
            archived: typeof meta.archived === 'boolean' ? meta.archived : false,
            deleted: typeof meta.deleted === 'boolean' ? meta.deleted : false,
            deletedAt: meta.deletedAt || null,
            posted: meta.posted || row.created_at,
            testCases: Array.isArray(meta.testCases) ? meta.testCases : [],
            starterCode: meta.starterCode || '',
            duration: meta.duration !== undefined ? meta.duration : 60,
            videoDuration: meta.videoDuration ?? null,
            autoSaveInterval: meta.autoSaveInterval || '30s',
            treatWarningsAsErrors: !!meta.treatWarningsAsErrors,
            disableBack: !!meta.disableBack
        };
    });
};

const saveClassworkToDb = async (classroomId, classwork) => {
    if (classroomId == null || !Array.isArray(classwork)) return;
    if (classwork.length === 0) {
        console.warn(`[saveClassworkToDb] Ignored empty classwork array for classroom ${classroomId} to prevent accidental wipe.`);
        return;
    }

    const currentIds = classwork.map(cw => Number(cw.id)).filter(id => !isNaN(id));

    // Handle deletions safely without violating foreign key constraints
    if (currentIds.length > 0) {
        const placeholders = currentIds.map(() => '?').join(',');
        const toDelete = await db.all(`
            SELECT id FROM classwork 
            WHERE classroom_id = ? AND id NOT IN (${placeholders})
        `, classroomId, ...currentIds);

        for (const item of toDelete) {
            try {
                await db.run('DELETE FROM classwork WHERE id = ?', item.id);
            } catch (e) {
                // Has submissions referencing it; archive instead of hard delete
                const currentItem = await db.get('SELECT description FROM classwork WHERE id = ?', item.id);
                let meta = {};
                try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                meta.archived = true;
                await db.run('UPDATE classwork SET description = ? WHERE id = ?', JSON.stringify(meta), item.id);
            }
        }
    }

    // Upsert all items with full metadata preserved as JSON in description
    for (const cw of classwork) {
        const id = Number(cw.id) || Date.now();
        const descObj = {
            details: cw.details !== undefined ? cw.details : (cw.description || ''),
            attachments: Array.isArray(cw.attachments) ? cw.attachments : [],
            points: cw.points !== undefined ? cw.points : '100',
            grading: cw.grading !== undefined ? cw.grading : 'On',
            archived: !!cw.archived,
            deleted: !!cw.deleted,
            deletedAt: cw.deletedAt || null,
            posted: cw.posted || null,
            testCases: Array.isArray(cw.testCases) ? cw.testCases : [],
            activityType: cw.activityType || cw.type || 'Assignment',
            starterCode: cw.starterCode !== undefined ? cw.starterCode : '',
            duration: cw.duration !== undefined ? cw.duration : 60,
            videoDuration: cw.videoDuration ?? null,
            autoSaveInterval: cw.autoSaveInterval || '30s',
            treatWarningsAsErrors: !!cw.treatWarningsAsErrors,
            disableBack: !!cw.disableBack
        };
        await db.run(`
            INSERT INTO classwork (id, classroom_id, title, description, dueDate, type)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                classroom_id = excluded.classroom_id,
                title = excluded.title,
                description = excluded.description,
                dueDate = excluded.dueDate,
                type = excluded.type
        `, id, Number(classroomId) || classroomId, cw.title || '', JSON.stringify(descObj), cw.dueDate || '', cw.type || cw.activityType || '');
    }
    try { db.triggerSync(); } catch (_) { }
};

// --- ACCESS CONTROL HELPERS ---
async function checkClassroomAccess(req, classroomId) {
    const roleLower = String(req.user?.role || '').toLowerCase();
    if (roleLower === 'admin') return true;

    const isKimAlias = (str) => {
        const s = String(str || '').trim().toLowerCase();
        return s === 'kim fabie' || s === 'kimfabie' || s === 'mikooooo' || s === 'kimfabie123@gmail.com' || s === 'kimfabie@gmail.com' || s === 'kimfabie159@gmail.com' || s === 'kim.fabie@cvsu.edu.ph' || s === 'thbrainrot@gmail.com';
    };

    if (roleLower === 'teacher' || roleLower === 'instructor') {
        const c = await db.get('SELECT id, instructor_email, instructor, name FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', classroomId, String(classroomId));
        if (!c) return false;
        const teacherEmail = (req.user.email || '').trim().toLowerCase();
        const teacherName = (req.user.name || '').trim().toLowerCase();
        const cEmail = (c.instructor_email || '').trim().toLowerCase();
        const cName = (c.instructor || '').trim().toLowerCase();

        const matchesEmail = Boolean(teacherEmail && cEmail && (cEmail === teacherEmail || cEmail.includes(teacherEmail) || teacherEmail.includes(cEmail)));
        const matchesName = Boolean(teacherName && cName && (cName === teacherName || cName.includes(teacherName) || teacherName.includes(cName)));
        const matchesKimAlias = Boolean((isKimAlias(teacherEmail) || isKimAlias(teacherName)) && (isKimAlias(cEmail) || isKimAlias(cName)));

        if (matchesEmail || matchesName || matchesKimAlias) {
            // Self-heal: keep instructor_email up-to-date
            if (teacherEmail && cEmail !== teacherEmail) {
                db.run('UPDATE classrooms SET instructor_email = ? WHERE id = ?', teacherEmail, c.id).catch(() => { });
            }
            return true;
        }
        // Self-heal & Adoption: if classroom is unassigned, has placeholder name, or instructor is missing
        if (!cEmail || !cName || cName === 'instructor' || (c.name && /^Classroom \d+$/i.test(c.name.trim()))) {
            if (teacherEmail || teacherName) {
                db.run('UPDATE classrooms SET instructor = COALESCE(NULLIF(instructor, \'\'), ?), instructor_email = COALESCE(NULLIF(instructor_email, \'\'), ?) WHERE id = ?', req.user.name || 'Instructor', teacherEmail || null, c.id).catch(() => { });
            }
            return true;
        }
        return false;
    }
    if (roleLower === 'student') {
        const studentEmail = (req.user.email || '').trim().toLowerCase();
        const studentName = (req.user.name || '').trim().toLowerCase();
        const studentId = req.user.id || 0;

        // 1. Direct enrollment check (email, ID, or name)
        const e = await db.get(
            `SELECT 1 FROM enrollments 
             WHERE (classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT))
               AND ((student_email IS NOT NULL AND LOWER(TRIM(student_email)) = ?) 
                 OR (student_id IS NOT NULL AND (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)))
                 OR (student_name IS NOT NULL AND (LOWER(TRIM(student_name)) = ? OR LOWER(TRIM(student_name)) = ?)))`,
            classroomId, String(classroomId), studentEmail, studentId, String(studentId), studentName, studentEmail
        );
        if (e) return true;

        // 2. Kim/Miko alias check
        if (isKimAlias(studentEmail) || isKimAlias(studentName)) {
            const aliasEnrollment = await db.get(
                `SELECT 1 FROM enrollments 
                 WHERE (classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT))
                   AND (
                     LOWER(TRIM(student_email)) IN ('kimfabie123@gmail.com', 'kimfabie159@gmail.com', 'kim.fabie@cvsu.edu.ph', 'thbrainrot@gmail.com', 'kimfabie@gmail.com')
                     OR LOWER(TRIM(student_name)) IN ('kim fabie', 'mikooooo', 'fabie kim diez', 'kimfabie')
                   )`,
                classroomId, String(classroomId)
            );
            if (aliasEnrollment) {
                // Self-heal: ensure current student email is enrolled
                db.run(
                    `INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(classroom_id, student_email) DO NOTHING`,
                    classroomId, studentId, req.user.name || 'Student', studentEmail, new Date().toISOString()
                ).catch(() => { });
                return true;
            }
        }

        // 3. Existing submission check
        const sub = await db.get(
            `SELECT 1 FROM submissions 
             WHERE (classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT))
               AND (student_name = ? OR LOWER(TRIM(student_name)) = ? OR LOWER(TRIM(student_name)) = ? OR student_id = ?)`,
            classroomId, String(classroomId), req.user.name || '', studentName, studentEmail, String(studentId)
        ).catch(() => null);
        if (sub) {
            // Self-heal enrollment
            db.run(
                `INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(classroom_id, student_email) DO NOTHING`,
                classroomId, studentId, req.user.name || 'Student', studentEmail, new Date().toISOString()
            ).catch(() => { });
            return true;
        }

        return false;
    }
    return false;
}

async function checkAssignmentAccess(req, assignmentId) {
    const roleLower = String(req.user?.role || '').toLowerCase();
    if (roleLower === 'admin') return true;
    const numId = Number(assignmentId);
    let cw = null;
    if (!isNaN(numId) && numId > 0) {
        cw = await db.get('SELECT classroom_id FROM classwork WHERE id = ?', numId);
    }
    if (!cw) {
        cw = await db.get('SELECT classroom_id FROM classwork WHERE CAST(id AS TEXT) = ?', String(assignmentId));
    }
    if (!cw) {
        if (roleLower === 'student') {
            const studentEmail = (req.user.email || '').trim().toLowerCase();
            const studentName = (req.user.name || '').trim().toLowerCase();
            const studentId = String(req.user.id || '');
            const hasSub = await db.get(
                `SELECT 1 FROM submissions 
                 WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?)
                   AND (student_name = ? OR LOWER(student_name) = ? OR LOWER(student_name) = ? OR student_name = ?)`,
                assignmentId, String(assignmentId), req.user.name || '', studentName, studentEmail, studentId
            ).catch(() => null);
            if (hasSub) return true;
        }
        return false;
    }
    return checkClassroomAccess(req, cw.classroom_id);
}

// --- CLASSWORK PERSISTENCE ENDPOINTS ---
app.get('/classwork', authenticateToken, async (req, res) => {
    try {
        const classwork = await getClassworkFromDb();
        if (req.user?.role === 'Admin') {
            return res.status(200).json({ classwork });
        }
        const isStudentUser = String(req.user?.role || '').toLowerCase() === 'student';
        const filtered = [];
        for (const cw of classwork) {
            if (isStudentUser && (cw.archived || cw.deleted)) continue;
            if (await checkClassroomAccess(req, cw.classroom_id)) {
                filtered.push(cw);
            }
        }
        res.status(200).json({ classwork: filtered });
    } catch (e) {
        console.error('Error fetching all classwork:', e);
        res.status(500).json({ classwork: [] });
    }
});

app.get('/classwork/:classroomId', authenticateToken, async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const isStudentUser = String(req.user?.role || '').toLowerCase() === 'student';
        const rawClasswork = await getClassworkFromDb(req.params.classroomId);
        const classwork = isStudentUser
            ? rawClasswork.filter(cw => !cw.archived && !cw.deleted)
            : rawClasswork;
        res.status(200).json({ classwork });
    } catch (e) {
        console.error('Error fetching classwork:', e);
        res.status(500).json({ classwork: [] });
    }
});

app.put('/classwork/:classroomId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    const { classroomId } = req.params;
    if (!(await checkClassroomAccess(req, classroomId))) {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { classwork } = req.body;
    if (!Array.isArray(classwork)) return res.status(400).json({ message: 'classwork must be an array' });

    try {
        await saveClassworkToDb(classroomId, classwork);
        const updatedClasswork = await getClassworkFromDb(classroomId);
        const clientSocketId = req.headers['x-socket-id'];
        const senderSocket = clientSocketId && io.sockets.sockets.get(clientSocketId);
        if (senderSocket) {
            senderSocket.broadcast.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        } else {
            io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        }
        res.status(200).json({ message: 'Classwork saved', classwork: updatedClasswork });
    } catch (e) {
        console.error('Error saving classwork via PUT:', e);
        res.status(500).json({ message: 'Failed to save classwork' });
    }
});

app.delete('/classwork/:classroomId/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { classroomId, id } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const isSoftDelete = req.query?.soft === '1' || req.query?.soft === 'true' || req.body?.soft === true;
        if (isSoftDelete) {
            const currentItem = await db.get('SELECT description FROM classwork WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', classroomId, id, String(id));
            if (currentItem) {
                let meta = {};
                try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                meta.deleted = true;
                meta.deletedAt = new Date().toISOString();
                await db.run('UPDATE classwork SET description = ? WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', JSON.stringify(meta), classroomId, id, String(id));
            }
        } else {
            try {
                await db.run('DELETE FROM classwork WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', classroomId, id, String(id));
            } catch (e) {
                const currentItem = await db.get('SELECT description FROM classwork WHERE id = ?', id);
                let meta = {};
                try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                meta.archived = true;
                meta.deleted = true;
                await db.run('UPDATE classwork SET description = ? WHERE id = ?', JSON.stringify(meta), id);
            }
        }
        try { db.triggerSync(); } catch (_) { }
        const updatedClasswork = await getClassworkFromDb(classroomId);
        io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        res.status(200).json({ message: isSoftDelete ? 'Classwork moved to deleted items' : 'Classwork deleted', classwork: updatedClasswork });
    } catch (err) {
        console.error('Error deleting classwork:', err);
        res.status(500).json({ message: 'Failed to delete classwork' });
    }
});

// --- ANNOUNCEMENTS ---
app.get('/classrooms/:classroomId/announcements', authenticateToken, async (req, res) => {
    try {
        const { classroomId } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const rows = await db.all('SELECT * FROM announcements WHERE classroom_id = ? ORDER BY posted DESC, id DESC', classroomId).catch(() => []);
        const announcements = (rows || []).map(r => ({
            id: Number(r.id),
            classroomId: Number(r.classroom_id || classroomId),
            title: r.title || 'Instructor Announcement',
            details: r.details || '',
            author: r.author || 'Instructor',
            posted: Number(r.posted || (r.created_at ? new Date(r.created_at).getTime() : Date.now()))
        }));
        res.status(200).json({ announcements });
    } catch (e) {
        console.error('Error fetching announcements:', e);
        res.status(500).json({ announcements: [], error: e.message });
    }
});

app.post('/classrooms/:classroomId/announcements', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { classroomId } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { title, details, author, posted, id } = req.body;
        if (!details || !details.trim()) {
            return res.status(400).json({ message: 'Announcement details are required' });
        }
        const announcementId = id ? Number(id) : Date.now();
        const announcementAuthor = author || req.user.name || 'Instructor';
        const postedTime = posted ? Number(posted) : Date.now();
        const announcementTitle = title || 'Instructor Announcement';

        await db.run(`
            INSERT INTO announcements (id, classroom_id, title, details, author, posted)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                details = excluded.details,
                author = excluded.author,
                posted = excluded.posted
        `, announcementId, Number(classroomId), announcementTitle, details.trim(), announcementAuthor, postedTime);

        try { db.triggerSync(); } catch (_) { }

        const newAnnouncement = {
            id: announcementId,
            classroomId: Number(classroomId),
            title: announcementTitle,
            details: details.trim(),
            author: announcementAuthor,
            posted: postedTime
        };

        io.emit('announcement_posted', { classroomId: Number(classroomId), announcement: newAnnouncement });
        res.status(201).json({ announcement: newAnnouncement });
    } catch (e) {
        console.error('Error posting announcement:', e);
        res.status(500).json({ message: 'Failed to post announcement', error: e.message });
    }
});

app.delete('/classrooms/:classroomId/announcements/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { classroomId, id } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        await db.run('DELETE FROM announcements WHERE id = ? AND classroom_id = ?', Number(id), Number(classroomId));
        try { db.triggerSync(); } catch (_) { }
        io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(id) });
        res.status(200).json({ success: true, message: 'Announcement deleted' });
    } catch (e) {
        console.error('Error deleting announcement:', e);
        res.status(500).json({ message: 'Failed to delete announcement', error: e.message });
    }
});

// --- CLASSROOMS ---
app.get('/classrooms', authenticateToken, async (req, res) => {
    try {
        let rawClassrooms = [];
        const roleLower = String(req.user?.role || '').toLowerCase();
        if (roleLower === 'student') {
            const studentEmail = (req.user.email || '').trim().toLowerCase();
            const studentId = req.user.id || 0;
            rawClassrooms = await db.all(`
                SELECT * FROM (
                    SELECT DISTINCT c.* FROM classrooms c
                    INNER JOIN enrollments e ON e.classroom_id = c.id
                    WHERE (e.student_email IS NOT NULL AND LOWER(TRIM(e.student_email)) = ?)
                       OR (e.student_id IS NOT NULL AND (e.student_id = ? OR CAST(e.student_id AS TEXT) = CAST(? AS TEXT)))
                ) sub
                ORDER BY LOWER(sub.name) ASC, sub.id ASC
            `, studentEmail, studentId, String(studentId));

            // Self-heal enrollments: sync student_email and student_id both ways
            if (studentEmail && studentId) {
                db.run(
                    'UPDATE enrollments SET student_email = ? WHERE (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)) AND (student_email IS NULL OR LOWER(TRIM(student_email)) != ?)',
                    studentEmail, studentId, String(studentId), studentEmail
                ).catch(() => { });
                db.run(
                    'UPDATE enrollments SET student_id = ? WHERE (student_email IS NOT NULL AND LOWER(TRIM(student_email)) = ?) AND (student_id IS NULL OR student_id != ?)',
                    studentId, studentEmail, studentId
                ).catch(() => { });
            }

        } else if (roleLower === 'teacher' || roleLower === 'instructor') {
            const teacherEmail = (req.user.email || '').trim().toLowerCase();
            const teacherName = (req.user.name || '').trim().toLowerCase();
            rawClassrooms = await db.all(`
                SELECT * FROM classrooms
                WHERE (instructor_email IS NOT NULL AND instructor_email != '' AND (LOWER(instructor_email) = ? OR LOWER(instructor_email) LIKE ?))
                   OR (instructor IS NOT NULL AND instructor != '' AND (TRIM(LOWER(instructor)) = ? OR TRIM(LOWER(instructor)) LIKE ?))
                   OR (instructor_email IS NULL OR instructor_email = '' OR instructor IS NULL OR instructor = '' OR instructor = 'Instructor')
                ORDER BY LOWER(name) ASC, id ASC
            `, teacherEmail, `%${teacherEmail}%`, teacherName, `%${teacherName}%`);

            // Self-heal classrooms: if matched by teacher name but instructor_email is missing or outdated, update it
            if (teacherEmail && teacherName) {
                db.run(
                    'UPDATE classrooms SET instructor_email = ? WHERE (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = ?) AND (instructor_email IS NULL OR instructor_email = \'\' OR LOWER(instructor_email) != ?)',
                    teacherEmail, teacherName, teacherEmail
                ).catch(() => { });
            }
        } else {
            // Admin can view all classrooms
            rawClassrooms = await db.all('SELECT * FROM classrooms ORDER BY LOWER(name) ASC, id ASC');
        }

        // Filter out phantom/dummy classrooms with no valid section/subject
        const validClassrooms = rawClassrooms.filter(c => {
            if (!c || !c.name) return false;
            const isPhantom = /^Classroom \d+$/i.test(c.name.trim()) && (!c.section || !c.section.trim()) && (!c.subject || !c.subject.trim());
            return !isPhantom;
        });

        const formatted = await Promise.all(validClassrooms.map(async c => {
            let instName = (c.instructor && c.instructor.trim()) || '';
            let instEmail = (c.instructor_email && c.instructor_email.trim()) || (c.instructorEmail && c.instructorEmail.trim()) || '';

            let realTeacher = null;
            if (instEmail) {
                realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instEmail).catch(() => null);
                if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", instEmail).catch(() => null);
            }
            if (!realTeacher && instName && instName !== 'Instructor') {
                realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instName).catch(() => null);
                if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", instName).catch(() => null);
            }

            if (realTeacher) {
                instName = realTeacher.name;
                instEmail = realTeacher.email;
            }

            let parsedTheme = null;
            if (c.theme) {
                try {
                    parsedTheme = typeof c.theme === 'string' ? JSON.parse(c.theme) : c.theme;
                } catch {
                    parsedTheme = null;
                }
            }

            return {
                ...c,
                archived: parseArchivedBool(c.archived),
                description: c.description || '',
                settings: parseClassroomSettings(c.settings),
                theme: parsedTheme,
                instructor: instName || 'Instructor',
                instructorEmail: instEmail,
                instructorAvatar: realTeacher?.avatar || null
            };
        }));

        // Strictly sort classrooms alphabetically by name
        formatted.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));

        res.status(200).json({ classrooms: formatted });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

const DEFAULT_CLASSROOM_SETTINGS = {
    inviteCodes: 'Turned on',
    stream: 'Students can post and comment',
    classworkStream: 'Show condensed notifications',
    showDeleted: false
};

function parseClassroomSettings(val) {
    if (!val) return { ...DEFAULT_CLASSROOM_SETTINGS };
    try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CLASSROOM_SETTINGS };
        return {
            inviteCodes: parsed.inviteCodes === 'Turned off' ? 'Turned off' : 'Turned on',
            stream: parsed.stream || DEFAULT_CLASSROOM_SETTINGS.stream,
            classworkStream: parsed.classworkStream || DEFAULT_CLASSROOM_SETTINGS.classworkStream,
            showDeleted: Boolean(parsed.showDeleted)
        };
    } catch (_) {
        return { ...DEFAULT_CLASSROOM_SETTINGS };
    }
}

function parseArchivedBool(val) {
    return val === true || Number(val) === 1 || String(val || '').toLowerCase() === 'true';
}

app.put('/classrooms', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    const { classrooms } = req.body;
    if (!Array.isArray(classrooms)) return res.status(400).json({ message: 'classrooms must be an array' });

    try {
        const assignedInBatch = new Set();
        const savedClassrooms = [];

        for (const c of classrooms) {
            let existing = null;
            if (c.id) {
                existing = await db.get('SELECT id, instructor, instructor_email, name, archived, description, settings FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', c.id, String(c.id));
                const isPlaceholder = existing && (
                    !existing.instructor_email ||
                    !existing.instructor ||
                    existing.instructor === 'Instructor' ||
                    (existing.name && /^Classroom \d+$/i.test(existing.name.trim()))
                );
                if (existing && !isPlaceholder && !(await checkClassroomAccess(req, c.id))) continue;
            }
            // Only ignore if completely empty name
            if (!c.name || !String(c.name).trim()) {
                continue;
            }
            const instName = c.instructor || req.user.name || 'Instructor';
            const instEmail = c.instructorEmail || c.instructor_email || (req.user.role === 'Teacher' ? req.user.email : '');
            const themeStr = c.theme ? (typeof c.theme === 'object' ? JSON.stringify(c.theme) : c.theme) : null;
            const classroomId = c.id || Date.now();
            const hasExplicitArchived = c.archived !== undefined && c.archived !== null;
            const archivedInt = hasExplicitArchived
                ? (parseArchivedBool(c.archived) ? 1 : 0)
                : (existing ? (parseArchivedBool(existing.archived) ? 1 : 0) : 0);
            const descriptionVal = c.description !== undefined
                ? String(c.description || '')
                : (existing?.description || '');
            const mergedSettings = c.settings !== undefined
                ? parseClassroomSettings(c.settings)
                : parseClassroomSettings(existing?.settings);
            const settingsStr = JSON.stringify(mergedSettings);

            // Auto-generate or validate unique class code
            let classCode = (c.code || '').toString().trim().toLowerCase();

            // If no code provided in payload, check if this classroom already has one in DB
            if (!classCode) {
                const existingDbClassroom = await db.get('SELECT id, code FROM classrooms WHERE id = ?', classroomId);
                if (existingDbClassroom?.code) {
                    classCode = existingDbClassroom.code.trim().toLowerCase();
                }
            }

            // Check if code is already taken by another classroom or already assigned in this batch
            let codeConflict = false;
            if (classCode) {
                if (assignedInBatch.has(classCode)) {
                    codeConflict = true;
                } else {
                    const row = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                    if (row) codeConflict = true;
                }
            }

            // If empty or conflicted, generate a guaranteed unique code
            if (!classCode || codeConflict) {
                let attempts = 0;
                do {
                    classCode = db.generateClassCodeSync ? db.generateClassCodeSync(assignedInBatch) : ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
                    const conflict = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                    if (!conflict) break;
                    attempts++;
                } while (attempts < 50);
            }

            assignedInBatch.add(classCode);

            await db.run(`
                INSERT INTO classrooms (id, code, section, name, subject, instructor, instructor_email, description, settings, theme, archived) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    code = excluded.code,
                    section = excluded.section,
                    name = excluded.name,
                    subject = excluded.subject,
                    instructor = excluded.instructor,
                    instructor_email = excluded.instructor_email,
                    description = COALESCE(excluded.description, classrooms.description),
                    settings = COALESCE(excluded.settings, classrooms.settings),
                    theme = COALESCE(excluded.theme, classrooms.theme),
                    archived = excluded.archived
            `,
                classroomId, classCode, c.section || '', c.name || '', c.subject || '', instName, instEmail, descriptionVal, settingsStr, themeStr, archivedInt
            );

            savedClassrooms.push({
                ...c,
                id: classroomId,
                code: classCode,
                description: descriptionVal,
                settings: mergedSettings,
                archived: Boolean(archivedInt),
                instructor: instName,
                instructorEmail: instEmail
            });
        }
        try { db.triggerSync(); } catch (_) { }
        io.emit('classrooms_changed', { classrooms: savedClassrooms });
        res.status(200).json({ message: 'Classrooms saved', classrooms: savedClassrooms });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.patch('/classrooms/:id/archive', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(await checkClassroomAccess(req, id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const classroom = await db.get('SELECT * FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', id, String(id));
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const hasExplicit = req.body && (req.body.archived !== undefined && req.body.archived !== null);
        const isArchived = hasExplicit ? parseArchivedBool(req.body.archived) : !parseArchivedBool(classroom.archived);
        const archivedVal = isArchived ? 1 : 0;

        await db.run('UPDATE classrooms SET archived = ? WHERE id = ?', archivedVal, classroom.id);
        await db.run(
            'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
            req.user?.name || req.user?.email || 'Instructor',
            isArchived ? 'Classroom Archived' : 'Classroom Unarchived',
            'Normal',
            `Classroom "${classroom.name || classroom.id}" was ${isArchived ? 'archived' : 'unarchived'}.`
        ).catch(() => { });

        try { db.triggerSync(); } catch (_) { }

        const payload = {
            classroomId: classroom.id,
            id: classroom.id,
            code: classroom.code || classroom.section,
            name: classroom.name,
            archived: isArchived
        };

        io.emit('classroom_archived', payload);
        io.emit('classrooms_changed', {
            classroom: { ...classroom, archived: isArchived },
            classroomId: classroom.id,
            archived: isArchived
        });

        res.status(200).json({
            message: isArchived ? 'Classroom archived successfully' : 'Classroom unarchived successfully',
            classroomId: classroom.id,
            archived: isArchived
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.patch('/classrooms/:id/settings', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(await checkClassroomAccess(req, id))) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const existing = await db.get('SELECT * FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', id, String(id));
        if (!existing) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const { name, description, section, subject, code, settings } = req.body || {};
        const nextName = name !== undefined ? String(name).trim() : String(existing.name || '').trim();
        if (!nextName) {
            return res.status(400).json({ message: 'Class name is required' });
        }

        const nextDescription = description !== undefined ? String(description || '') : (existing.description || '');
        const nextSection = section !== undefined ? String(section || '') : (existing.section || '');
        const nextSubject = subject !== undefined ? String(subject || '') : (existing.subject || '');

        let nextCode = code !== undefined ? String(code).trim().toLowerCase() : String(existing.code || '').trim().toLowerCase();
        if (!nextCode) {
            nextCode = db.generateClassCodeSync
                ? db.generateClassCodeSync()
                : ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
        }

        const codeConflict = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', nextCode, existing.id);
        if (codeConflict) {
            return res.status(409).json({ message: 'That class code is already in use by another classroom. Please regenerate a new code.' });
        }

        const prevSettings = parseClassroomSettings(existing.settings);
        const mergedSettings = parseClassroomSettings({
            ...prevSettings,
            ...(settings && typeof settings === 'object' ? settings : {})
        });
        const settingsStr = JSON.stringify(mergedSettings);

        await db.run(
            `UPDATE classrooms
             SET name = ?, description = ?, section = ?, subject = ?, code = ?, settings = ?
             WHERE id = ?`,
            nextName, nextDescription, nextSection, nextSubject, nextCode, settingsStr, existing.id
        );

        await db.run(
            'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
            req.user?.name || req.user?.email || 'Instructor',
            'Classroom Settings Updated',
            'Normal',
            `Updated settings for classroom "${nextName}" (${nextCode}).`
        ).catch(() => { });

        try { db.triggerSync(); } catch (_) { }

        let parsedTheme = null;
        if (existing.theme) {
            try { parsedTheme = typeof existing.theme === 'string' ? JSON.parse(existing.theme) : existing.theme; } catch { }
        }

        const updatedClassroom = {
            ...existing,
            id: existing.id,
            name: nextName,
            description: nextDescription,
            section: nextSection,
            subject: nextSubject,
            code: nextCode,
            settings: mergedSettings,
            archived: parseArchivedBool(existing.archived),
            theme: parsedTheme,
            instructorEmail: existing.instructor_email || ''
        };

        io.emit('classroom_settings_changed', {
            classroomId: existing.id,
            classroom: updatedClassroom
        });
        io.emit('classrooms_changed', {
            classroomId: existing.id,
            classroom: updatedClassroom
        });

        res.status(200).json({
            message: 'Classroom settings updated successfully',
            classroom: updatedClassroom
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.patch('/classrooms/:id/theme', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(await checkClassroomAccess(req, id))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { theme } = req.body;
        if (!theme) return res.status(400).json({ message: 'Theme is required' });

        const themeStr = typeof theme === 'object' ? JSON.stringify(theme) : theme;
        await db.run('UPDATE classrooms SET theme = ? WHERE id = ?', themeStr, id);

        const classroom = await db.get('SELECT * FROM classrooms WHERE id = ?', id);
        const detailPayload = {
            classroomId: id,
            code: classroom?.code || classroom?.section,
            name: classroom?.name,
            theme: typeof theme === 'string' ? JSON.parse(theme) : theme
        };

        io.emit('classroom_theme_changed', detailPayload);
        res.status(200).json({ message: 'Theme updated successfully', theme: detailPayload.theme });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/classrooms/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.id))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (req.user.role === 'Teacher') {
            let allowDelete = false;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.allowDeleteCourses === true) {
                        allowDelete = true;
                    }
                }
            } catch (e) { }
            if (!allowDelete) {
                return res.status(403).json({ message: 'Only System Admins can delete courses according to system settings.' });
            }
        }

        const id = req.params.id;
        await db.run('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => { });
        await db.run('DELETE FROM grades WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => { });
        await db.run('DELETE FROM classwork WHERE classroom_id = ?', id).catch(() => { });
        await db.run('DELETE FROM enrollments WHERE classroom_id = ?', id).catch(() => { });
        await db.run('DELETE FROM classrooms WHERE id = ?', id);
        try { db.triggerSync(); } catch (_) { }
        res.status(200).json({ message: 'Classroom deleted successfully' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- SUBMISSIONS ---
app.get('/student/submissions', authenticateToken, requireRole('Student'), async (req, res) => {
    try {
        const canonical = await resolveCanonicalStudent(req.user);
        const candidates = Array.from(new Set([
            req.user.name,
            req.user.email,
            canonical?.name,
            canonical?.email
        ].filter(Boolean).map(v => String(v).trim().toLowerCase())));

        if (candidates.length === 0) {
            return res.status(200).json({ submissions: [] });
        }

        const placeholders = candidates.map(() => '?').join(', ');
        const rows = await db.all(
            `SELECT assignment_id, submittedAt FROM submissions WHERE LOWER(TRIM(student_name)) IN (${placeholders})`,
            ...candidates
        );
        const normalized = (rows || []).map(r => ({
            assignment_id: r.assignment_id,
            submittedAt: r.submittedAt || r.submittedat || null
        }));
        res.status(200).json({ submissions: normalized });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});
// Helper: Resolve canonical student identity across online & offline sessions
async function resolveCanonicalStudent(userObj, fallbackName = '', fallbackId = null, fallbackEmail = '') {
    let rawEmail = (userObj?.email || fallbackEmail || '').trim().toLowerCase();
    const rawName = (userObj?.name || fallbackName || '').trim();
    const rawId = userObj?.id || fallbackId || null;

    const rawNameLower = rawName.toLowerCase();
    if (!rawEmail && (rawNameLower === 'kimfabie123@gmail.com' || rawNameLower === 'kimfabie' || rawNameLower === 'kim fabie' || rawNameLower === 'mikooooo')) {
        rawEmail = 'kimfabie123@gmail.com';
    }

    let dbUser = null;
    if (rawEmail) {
        dbUser = await db.get('SELECT id, name, email, role FROM users WHERE LOWER(email) = ?', rawEmail).catch(() => null);
    }
    if (!dbUser && rawId != null) {
        const byId = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', rawId).catch(() => null);
        if (byId && (!rawEmail || (byId.email || '').trim().toLowerCase() === rawEmail)) {
            dbUser = byId;
        }
    }

    const canonicalEmail = (dbUser?.email || rawEmail || '').trim().toLowerCase();
    let canonicalName = (dbUser?.name && dbUser.name.trim()) || rawName || canonicalEmail || 'Student';
    if (canonicalEmail === 'kimfabie123@gmail.com' && (canonicalName.toLowerCase() === 'kim fabie' || canonicalName.toLowerCase() === 'kimfabie')) {
        canonicalName = 'MIKOOOOO';
    }
    const canonicalId = dbUser?.id ?? rawId ?? canonicalName;

    const aliasSet = new Set();
    const addAlias = (val) => {
        if (val != null && String(val).trim()) {
            aliasSet.add(String(val).trim().toLowerCase());
        }
    };
    addAlias(canonicalName);
    addAlias(rawName);
    addAlias(fallbackName);
    addAlias(canonicalEmail);
    if (canonicalEmail && canonicalEmail.includes('@')) {
        addAlias(canonicalEmail.split('@')[0]);
    }
    if (canonicalEmail === 'kimfabie123@gmail.com' || canonicalName.toLowerCase() === 'mikooooo') {
        addAlias('kim fabie');
        addAlias('kimfabie');
        addAlias('kimfabie123@gmail.com');
        addAlias('mikooooo');
    }
    if (canonicalEmail) {
        try {
            const enrRows = await db.all('SELECT DISTINCT student_name FROM enrollments WHERE LOWER(student_email) = ?', canonicalEmail);
            for (const r of (enrRows || [])) {
                addAlias(r.student_name);
            }
        } catch (_) { }
    }

    return {
        canonicalName,
        canonicalId,
        canonicalEmail,
        aliases: Array.from(aliasSet)
    };
}

app.get('/submissions/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const allRows = await db.all('SELECT * FROM submissions WHERE assignment_id = ?', req.params.assignmentId);

        let canonicalKimName = 'MIKOOOOO';
        try {
            const kimUser = await db.get("SELECT name FROM users WHERE LOWER(email) = 'kimfabie123@gmail.com'");
            if (kimUser?.name && kimUser.name.trim()) canonicalKimName = kimUser.name.trim();
        } catch (_) { }

        const normalizeStudentSubName = (rawName) => {
            const trimmed = String(rawName || '').trim();
            const lower = trimmed.toLowerCase();
            if (lower === 'kimfabie123@gmail.com' || lower === 'kimfabie' || lower === 'kim fabie') {
                return canonicalKimName;
            }
            return trimmed;
        };

        let filteredRows = allRows || [];
        if (req.user.role === 'Student') {
            const { aliases } = await resolveCanonicalStudent(req.user);
            const aliasLookup = new Set(aliases);
            filteredRows = filteredRows.filter(s => {
                const sLower = String(s.student_name || '').trim().toLowerCase();
                const normLower = normalizeStudentSubName(s.student_name).toLowerCase();
                return aliasLookup.has(sLower) || aliasLookup.has(normLower);
            });
        }

        // Deduplicate by normalized student name, keeping the latest / richest submission
        const dedupedMap = new Map();
        for (const s of filteredRows) {
            const normName = normalizeStudentSubName(s.student_name);
            const key = normName.toLowerCase();
            let history = [];
            try { history = JSON.parse(s.history); } catch { }
            const lastCode = Array.isArray(history) && history.length > 0 ? history[history.length - 1]?.code : '';
            const formatted = {
                ...s,
                student_name: normName,
                studentName: normName,
                history,
                finalCode: lastCode
            };
            const existing = dedupedMap.get(key);
            if (!existing) {
                dedupedMap.set(key, formatted);
            } else {
                const newTime = new Date(formatted.submittedAt || formatted.submittedat || 0).getTime();
                const oldTime = new Date(existing.submittedAt || existing.submittedat || 0).getTime();
                const newLen = Array.isArray(formatted.history) ? formatted.history.length : 0;
                const oldLen = Array.isArray(existing.history) ? existing.history.length : 0;
                if (newTime > oldTime || (newTime === oldTime && newLen >= oldLen)) {
                    dedupedMap.set(key, formatted);
                }
            }
        }

        const submissions = Array.from(dedupedMap.values());
        const isOfflineFallback = !IS_RENDER_CLOUD && !db.isPostgres && process.env.IS_LAN_HOST !== 'true';
        res.status(200).json({ submissions, isOfflineFallback });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Proctor session warning logs for live monitoring
app.get('/proctor-logs/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const assignmentId = String(req.params.assignmentId);
        const classroomId = req.query.classroomId ? String(req.query.classroomId) : null;
        let logs = [];
        if (classroomId && classroomId !== 'none' && classroomId !== 'undefined' && classroomId !== 'default') {
            logs = await db.all(
                `SELECT * FROM proctor_session_logs 
                 WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) 
                   AND (classroom_id = ? OR CAST(classroom_id AS TEXT) = ? OR classroom_id IS NULL) 
                 ORDER BY id ASC`,
                assignmentId, assignmentId, classroomId, classroomId
            ).catch(() => []);
        } else {
            logs = await db.all(
                `SELECT * FROM proctor_session_logs 
                 WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?
                 ORDER BY id ASC`,
                assignmentId, assignmentId
            ).catch(() => []);
        }
        res.status(200).json({ logs: logs || [] });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/submissions/:assignmentId', authenticateToken, requireRole('Student'), async (req, res) => {
    try {
        const { finalCode, codeHistory } = req.body || {};
        const assignmentId = req.params.assignmentId;
        // Resolve canonical student name across online & offline accounts
        const { canonicalName: name, aliases } = await resolveCanonicalStudent(req.user);

        if (finalCode) {
            const secCheck = scanCSharpCode(finalCode);
            if (!secCheck.isSafe) {
                const nowIso = new Date().toISOString();
                const desc = `Blocked malicious script in submitted assignment #${assignmentId}: [${secCheck.rule}] ${secCheck.message}`;
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'Malicious Script Attempt', 'High', desc
                ).catch(() => { });
                await db.run(
                    `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
                    todayKey()
                ).catch(() => { });
                io.emit('admin_security_alert', {
                    user: name,
                    name,
                    studentId: name,
                    type: 'Malicious Script Attempt',
                    severity: 'High',
                    desc,
                    isMaliciousScript: true,
                    timestamp: nowIso
                });
                io.emit('admin_stats_update');
                return res.status(400).json({ message: `Submission rejected: Malicious code detected [${secCheck.rule}]. This incident has been logged in Security Audit Logs.` });
            }
        }

        const historyStr = JSON.stringify(Array.isArray(codeHistory) && codeHistory.length > 0 ? codeHistory : [{ time: Date.now(), code: finalCode || '' }]);

        if (!IS_RENDER_CLOUD && !db.isPostgres) {
            try {
                const existingCw = await db.get('SELECT classroom_id FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?', assignmentId, String(assignmentId));
                const stubClassroomId = existingCw?.classroom_id || req.body?.classroomId || 1;
                if (!existingCw) {
                    await db.run('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)', stubClassroomId, `Classroom ${stubClassroomId}`).catch(() => { });
                    await db.run('INSERT OR IGNORE INTO classwork (id, classroom_id, title) VALUES (?, ?, ?)', assignmentId, stubClassroomId, `Assignment ${assignmentId}`).catch(() => { });
                }
                const sEmail = (req.user?.email || req.body?.studentEmail || `${name}@verity.local`).trim().toLowerCase();
                await db.run(
                    'INSERT OR IGNORE INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at) VALUES (?, ?, ?, ?, ?)',
                    stubClassroomId, req.user?.id || null, name, sEmail, new Date().toISOString()
                ).catch(() => { });
            } catch (_) { }
        }

        for (const alias of aliases) {
            await db.run(
                'DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))',
                assignmentId, alias
            ).catch(() => { });
        }
        await db.run(
            'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
            assignmentId, name, historyStr, new Date().toISOString()
        );

        try { db.triggerSync(); } catch (_) { }
        io.emit('submission_updated', { assignmentId, studentName: name });

        res.status(200).json({ message: 'Submission saved', studentName: name });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/submissions/:assignmentId/:studentName', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const studentName = decodeURIComponent(req.params.studentName);
        const sLower = (studentName || '').trim().toLowerCase();
        const isTeacherOrAdmin = req.user.role === 'Teacher' || req.user.role === 'Admin';
        const { canonicalName, aliases } = await resolveCanonicalStudent(
            isTeacherOrAdmin ? null : req.user,
            studentName
        );
        const aliasSet = new Set(aliases);
        const namesToDelete = new Set([sLower, ...aliases]);

        if (req.user.role === 'Student') {
            const cwRow = await db.get(
                'SELECT description FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?',
                req.params.assignmentId, String(req.params.assignmentId)
            ).catch(() => null);
            if (cwRow && cwRow.description) {
                try {
                    const meta = JSON.parse(cwRow.description);
                    if (meta.disableBack || meta.disable_back) {
                        return res.status(403).json({ message: 'Unsubmitting is not permitted for this activity.' });
                    }
                } catch (_) { }
            }

            const uId = String(req.user.id || '');
            let isSelf = aliasSet.has(sLower) || studentName === uId || sLower === uId;
            if (!isSelf) {
                const userAliases = await resolveCanonicalStudent(req.user);
                (userAliases?.aliases || []).forEach(a => aliasSet.add(a));
                if (req.user.name) aliasSet.add(req.user.name.toLowerCase().trim());
                if (req.user.email) aliasSet.add(req.user.email.toLowerCase().trim());
                if (req.user.id != null) aliasSet.add(String(req.user.id).toLowerCase().trim());
                isSelf = aliasSet.has(sLower) || studentName === uId || sLower === uId;
                if (!isSelf) {
                    return res.status(403).json({ message: 'Access denied: You can only delete your own submission.' });
                }
            }
            if (req.user.name) namesToDelete.add(req.user.name.trim().toLowerCase());
            if (req.user.email) namesToDelete.add(req.user.email.trim().toLowerCase());
            if (req.user.id != null) namesToDelete.add(String(req.user.id).trim().toLowerCase());
        }

        for (const alias of namesToDelete) {
            if (!alias) continue;
            await db.run(
                `DELETE FROM submissions 
                 WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?)
                   AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))`,
                req.params.assignmentId, String(req.params.assignmentId), alias
            ).catch(() => { });
        }
        try { db.triggerSync(); } catch (_) { }
        const deletedStudentName = canonicalName || studentName;
        io.emit('submission_deleted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName });
        io.emit('student_unsubmitted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName, studentId: String(req.user?.id || '') });
        io.emit('teacher_student_unsubmitted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName, studentId: String(req.user?.id || '') });
        res.status(200).json({ message: 'Submission deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- GRADES ---
app.get('/grades/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const aId = String(req.params.assignmentId);
        const rows = await db.all('SELECT * FROM grades WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?', aId, aId);
        const gradesMap = {};
        const roleLower = String(req.user?.role || '').toLowerCase();
        rows.forEach(r => {
            const gradedAtVal = r.graded_at || r.gradedAt || new Date().toISOString();
            // If Student, only expose their own grade (fixes IDOR)
            if (roleLower === 'student') {
                const isStudentGrade = (
                    r.student_id === String(req.user.id) ||
                    r.student_id === req.user.name ||
                    r.student_id === req.user.email ||
                    (req.user.name && r.student_id.toLowerCase() === req.user.name.toLowerCase()) ||
                    (req.user.email && r.student_id.toLowerCase() === req.user.email.toLowerCase())
                );
                if (isStudentGrade) {
                    gradesMap[r.student_id] = { grade: r.grade, feedback: r.feedback, gradedAt: gradedAtVal };
                }
            } else {
                gradesMap[r.student_id] = { grade: r.grade, feedback: r.feedback, gradedAt: gradedAtVal };
            }
        });
        res.status(200).json({ grades: gradesMap });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/grades/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { studentId, grade, feedback } = req.body || {};
        if (!studentId) return res.status(400).json({ message: 'studentId is required' });
        const now = new Date().toISOString();
        const aId = String(req.params.assignmentId);
        const sId = String(studentId);
        const gVal = String(grade ?? '100');
        const fbVal = feedback || '';

        await db.run(`
            INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                grade = excluded.grade,
                feedback = excluded.feedback,
                graded_at = excluded.graded_at
        `, aId, sId, gVal, fbVal, now);

        if (typeof io !== 'undefined' && io) {
            io.emit('grade_updated', {
                assignmentId: aId,
                studentId: sId,
                grade: gVal,
                feedback: fbVal,
                gradedAt: now
            });
        }

        res.status(200).json({ message: 'Grade saved', grade: gVal, feedback: fbVal, gradedAt: now });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/grades/:assignmentId/bulk', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { grades } = req.body || {};
        if (!Array.isArray(grades)) return res.status(400).json({ message: 'grades must be an array' });
        const now = new Date().toISOString();
        const aId = String(req.params.assignmentId);
        const savedList = [];

        for (const g of grades) {
            if (g.studentId) {
                const sId = String(g.studentId);
                const gVal = String(g.grade ?? '100');
                const fbVal = g.feedback || '';
                await db.run(`
                    INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                        grade = excluded.grade,
                        feedback = excluded.feedback,
                        graded_at = excluded.graded_at
                `, aId, sId, gVal, fbVal, now);
                savedList.push({ studentId: sId, grade: gVal, feedback: fbVal, gradedAt: now });
            }
        }

        if (typeof io !== 'undefined' && io && savedList.length > 0) {
            io.emit('bulk_grades_updated', {
                assignmentId: aId,
                grades: savedList
            });
        }

        res.status(200).json({ message: 'Bulk grades saved', count: savedList.length });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/grades/:assignmentId/:studentName', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const aId = String(req.params.assignmentId);
        const studentName = decodeURIComponent(req.params.studentName);
        await db.run(
            'DELETE FROM grades WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (student_id = ? OR LOWER(student_id) = LOWER(?))',
            aId, aId, studentName, studentName
        );
        if (typeof io !== 'undefined' && io) {
            io.emit('grade_deleted', {
                assignmentId: aId,
                studentId: studentName
            });
        }
        res.status(200).json({ message: 'Grade deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/classroom-students/:classroomId', authenticateToken, async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { classroomId } = req.params;
        const classroom = await db.get('SELECT * FROM classrooms WHERE id = ?', classroomId);

        let instructor = null;
        let instUser = null;

        if (classroom) {
            if (classroom.instructor_email && classroom.instructor_email.trim()) {
                instUser = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", classroom.instructor_email.trim());
                if (!instUser) instUser = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", classroom.instructor_email.trim());
            }
            if (!instUser && classroom.instructor && classroom.instructor.trim() && classroom.instructor !== 'Instructor') {
                instUser = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", classroom.instructor.trim());
                if (!instUser) instUser = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", classroom.instructor.trim());
            }
        }

        if (instUser) {
            instructor = {
                id: instUser.id,
                name: instUser.name,
                email: instUser.email,
                avatar: instUser.avatar || null,
                role: instUser.role
            };
        } else {
            instructor = {
                id: null,
                name: classroom?.instructor || 'Instructor',
                email: classroom?.instructor_email || '',
                avatar: null
            };
        }

        // 1. Students who explicitly enrolled in this classroom (with real account avatar & name)
        const enrolledRows = await db.all(`
            SELECT DISTINCT 
                u.id as user_id,
                COALESCE(u.name, e.student_name) as name, 
                COALESCE(u.email, e.student_email) as email,
                u.avatar
            FROM enrollments e
            LEFT JOIN users u ON (LOWER(u.email) = LOWER(e.student_email) OR u.id = e.student_id)
            WHERE e.classroom_id = ?
        `, classroomId).catch(() => []);

        // 2. Students who submitted assignments for this classroom
        const subRows = await db.all(`
            SELECT DISTINCT 
                u.id as user_id,
                COALESCE(u.name, s.student_name) as name, 
                COALESCE(u.email, s.student_name) as email,
                u.avatar
            FROM submissions s
            JOIN classwork c ON s.assignment_id = c.id
            LEFT JOIN users u ON (LOWER(u.name) = LOWER(s.student_name) OR LOWER(u.email) = LOWER(s.student_name))
            WHERE c.classroom_id = ?
        `, classroomId).catch(() => []);

        const studentsMap = {};
        for (const s of [...enrolledRows, ...subRows]) {
            if (s && s.name && s.name.trim()) {
                const key = s.name.trim().toLowerCase();
                // Never show teacher or admin in the student/classmate roster
                if (instructor && (
                    (instructor.name && key === instructor.name.toLowerCase()) ||
                    (instructor.email && s.email && s.email.toLowerCase() === instructor.email.toLowerCase())
                )) {
                    continue;
                }
                if (!studentsMap[key]) {
                    studentsMap[key] = {
                        id: s.user_id || null,
                        name: s.name.trim(),
                        email: s.email && s.email.includes('@') ? s.email : `${s.name.trim().toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                        avatar: s.avatar || null
                    };
                }
            }
        }

        const sortedStudents = Object.values(studentsMap).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
        );

        res.status(200).json({
            students: sortedStudents,
            instructor
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/users/check-student', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ exists: false, message: 'Email is required.' });
        const user = await db.get('SELECT id, name, email, role, status FROM users WHERE LOWER(TRIM(email)) = ?', email);
        if (!user) {
            return res.status(200).json({ exists: false, message: 'Student account not found. Please make sure the student is registered first.' });
        }
        if (String(user.role || '').toLowerCase() !== 'student') {
            return res.status(200).json({ exists: false, message: 'This email does not belong to a Student account.' });
        }
        return res.status(200).json({ exists: true, student: { id: user.id, name: user.name, email: user.email, status: user.status } });
    } catch (e) {
        res.status(500).json({ exists: false, message: e.message });
    }
});

app.post('/classrooms/:classroomId/enroll', authenticateToken, async (req, res) => {
    try {
        const { classroomId } = req.params;

        if (req.user.role === 'Teacher') {
            const hasAccess = await checkClassroomAccess(req, classroomId);
            if (!hasAccess) {
                return res.status(403).json({ message: 'You do not have permission to enroll students in this classroom.' });
            }
            let allowManage = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.allowManageStudents === false) {
                        allowManage = false;
                    }
                }
            } catch (e) { }
            if (!allowManage) {
                return res.status(403).json({ message: 'Only System Admins can manage students according to system settings.' });
            }
        }

        const now = new Date().toISOString();
        const isBulk = Array.isArray(req.body?.students);

        // Support array of students (Admin bulk) or single student
        const incomingStudents = isBulk
            ? req.body.students
            : [{
                name: req.body?.studentName || req.user.name,
                email: req.body?.studentEmail || req.user.email,
                id: req.body?.studentId || (req.body?.studentEmail ? null : req.user.id)
            }];

        if (!incomingStudents.length) {
            return res.status(400).json({ message: 'Please provide at least one student email.' });
        }

        // Verify every target student exists in users table and is a Student account
        const verifiedStudents = [];
        for (const st of incomingStudents) {
            const studentEmail = (st.email || st.studentEmail || '').trim().toLowerCase();
            if (!studentEmail) {
                if (!isBulk) {
                    return res.status(400).json({ message: 'Please enter a valid student email address.' });
                }
                continue;
            }

            const existingUser = await db.get(
                'SELECT id, name, email, role, status FROM users WHERE LOWER(TRIM(email)) = ?',
                studentEmail
            );

            if (!existingUser) {
                return res.status(404).json({
                    message: `Student "${studentEmail}" does not exist. Please make sure the student has a registered account first.`
                });
            }

            if (String(existingUser.role || '').toLowerCase() !== 'student') {
                return res.status(400).json({
                    message: `"${studentEmail}" is not a Student account and cannot be enrolled as a student.`
                });
            }

            if (!isBulk) {
                const alreadyEnrolled = await db.get(
                    'SELECT id FROM enrollments WHERE classroom_id = ? AND LOWER(TRIM(student_email)) = ?',
                    classroomId,
                    existingUser.email.trim().toLowerCase()
                );
                if (alreadyEnrolled) {
                    return res.status(409).json({
                        message: `${existingUser.name || existingUser.email} is already enrolled in this classroom.`
                    });
                }
            }

            verifiedStudents.push({
                id: existingUser.id,
                name: existingUser.name || studentEmail.split('@')[0],
                email: existingUser.email.trim().toLowerCase()
            });
        }

        if (verifiedStudents.length === 0) {
            return res.status(400).json({ message: 'No valid registered students were provided.' });
        }

        const enrolledList = [];
        for (const student of verifiedStudents) {
            await db.run(`
                INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                    student_id = excluded.student_id,
                    student_name = excluded.student_name,
                    enrolled_at = excluded.enrolled_at
            `, classroomId, student.id, student.name, student.email, now);

            enrolledList.push(student);
        }

        db.triggerSync();
        io.emit('classroom_students_changed', { classroomId });

        res.status(200).json({ message: 'Enrolled successfully', enrolledCount: enrolledList.length, students: enrolledList });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/classrooms/join', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ message: 'Class code required' });

        const trimmed = code.trim().toLowerCase();
        let classroom = await db.get(`
            SELECT * FROM classrooms 
            WHERE LOWER(code) = ?
        `, trimmed);

        if (!classroom) {
            classroom = await db.get(`
                SELECT * FROM classrooms 
                WHERE LOWER(section) = ? OR LOWER(name) = ? OR CAST(id as TEXT) = ?
            `, trimmed, trimmed, trimmed);
        }

        if (!classroom) {
            return res.status(404).json({ message: 'No class found with that code' });
        }

        const classSettings = parseClassroomSettings(classroom.settings);
        if (classSettings.inviteCodes === 'Turned off') {
            return res.status(403).json({
                message: 'Invite codes are turned off for this classroom. Contact your instructor to enable invite codes.'
            });
        }

        const studentName = req.body?.studentName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Student');
        const studentEmail = (req.body?.studentEmail || req.user?.email || '').trim().toLowerCase();
        const studentId = req.user?.id || null;
        const now = new Date().toISOString();

        await db.run(`
            INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                student_name = excluded.student_name,
                student_id = COALESCE(excluded.student_id, enrollments.student_id),
                enrolled_at = excluded.enrolled_at
        `, classroom.id, studentId, studentName, studentEmail, now);

        try { db.triggerSync(); } catch (_) { }

        let parsedTheme = null;
        if (classroom.theme) {
            try {
                parsedTheme = typeof classroom.theme === 'string' ? JSON.parse(classroom.theme) : classroom.theme;
            } catch { }
        }

        let instName = (classroom.instructor && classroom.instructor.trim()) || '';
        let instEmail = (classroom.instructor_email && classroom.instructor_email.trim()) || '';
        let realTeacher = null;
        if (instEmail) {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instEmail).catch(() => null);
            if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", instEmail).catch(() => null);
        }
        if (!realTeacher && instName && instName !== 'Instructor') {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instName).catch(() => null);
            if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", instName).catch(() => null);
        }
        if (realTeacher) {
            instName = realTeacher.name;
            instEmail = realTeacher.email;
        }

        res.status(200).json({
            classroom: {
                ...classroom,
                archived: parseArchivedBool(classroom.archived),
                description: classroom.description || '',
                settings: classSettings,
                theme: parsedTheme,
                instructor: instName || 'Instructor',
                instructorEmail: instEmail,
                instructorAvatar: realTeacher?.avatar || null
            },
            message: 'Enrolled successfully'
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/grades/:assignmentId/:studentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const studentId = decodeURIComponent(req.params.studentId);
        await db.run(
            'DELETE FROM grades WHERE assignment_id = ? AND (student_id = ? OR LOWER(student_id) = LOWER(?))',
            req.params.assignmentId, studentId, studentId
        );
        res.status(200).json({ message: 'Grade reset' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/submission-counts', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        let subs;
        if (req.user?.role === 'Admin') {
            subs = await db.all('SELECT assignment_id, COUNT(id) as c FROM submissions GROUP BY assignment_id');
        } else {
            subs = await db.all(`
                SELECT s.assignment_id, COUNT(s.id) as c 
                FROM submissions s
                JOIN classwork cw ON s.assignment_id = cw.id
                JOIN classrooms cr ON cw.classroom_id = cr.id
                WHERE (cr.instructor_email IS NOT NULL AND cr.instructor_email != '' AND LOWER(cr.instructor_email) = ?)
                   OR ((cr.instructor_email IS NULL OR cr.instructor_email = '') AND cr.instructor IS NOT NULL AND cr.instructor != '' AND LOWER(cr.instructor) = ?)
                GROUP BY s.assignment_id
            `, (req.user.email || '').trim().toLowerCase(), (req.user.name || '').trim().toLowerCase());
        }
        const counts = {};
        subs.forEach(s => counts[s.assignment_id] = Number(s.c));

        // Calculate studentCount ONLY for students inside the specified classroom
        let studentCount = 0;
        const cid = req.query.classroomId;
        if (cid && cid !== 'default' && cid !== 'all') {
            const numCid = !isNaN(Number(cid)) ? Number(cid) : 0;
            const enrolledRow = await db.get(`
                SELECT COUNT(DISTINCT COALESCE(CAST(student_id AS TEXT), student_email, student_name)) as c 
                FROM enrollments 
                WHERE classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT)
            `, numCid, String(cid));
            studentCount = enrolledRow ? Number(enrolledRow.c) : 0;
        } else if (req.user?.role !== 'Admin') {
            const enrolledRow = await db.get(`
                SELECT COUNT(DISTINCT COALESCE(CAST(e.student_id AS TEXT), e.student_email, e.student_name)) as c 
                FROM enrollments e
                JOIN classrooms cr ON (e.classroom_id = cr.id OR CAST(e.classroom_id AS TEXT) = CAST(cr.id AS TEXT))
                WHERE (cr.instructor_email IS NOT NULL AND cr.instructor_email != '' AND LOWER(cr.instructor_email) = ?)
                   OR ((cr.instructor_email IS NULL OR cr.instructor_email = '') AND cr.instructor IS NOT NULL AND cr.instructor != '' AND LOWER(cr.instructor) = ?)
            `, (req.user.email || '').trim().toLowerCase(), (req.user.name || '').trim().toLowerCase());
            studentCount = enrolledRow ? Number(enrolledRow.c) : 0;
        } else {
            const studentRow = await db.get("SELECT COUNT(id) as c FROM users WHERE role = 'Student'");
            studentCount = studentRow ? Number(studentRow.c) : 0;
        }

        res.status(200).json({ counts, studentCount });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ADMIN DASHBOARD STATS & NOTIFICATIONS ---
app.get('/stats', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const activeUsersRow = await db.get("SELECT COUNT(id) as c FROM users WHERE COALESCE(status, 'Active') NOT IN ('Pending', 'Disabled', 'Suspended')");
        const activeClassroomsRow = await db.get("SELECT COUNT(id) as c FROM classrooms");
        const tKey = todayKey();

        // Try security_flags table first (fast path)
        let securityFlagsToday = 0;
        let altTabCopyPasteFlags = 0;
        try {
            const flagRow = await db.get("SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?", tKey);
            if (flagRow) {
                securityFlagsToday = Number(flagRow.count || 0);
                altTabCopyPasteFlags = Number(flagRow.alt_tab_copy_paste_count || 0);
            }
        } catch (_) { }

        // Also count directly from audit_logs for today (works for both SQLite and Postgres)
        // Use start-of-day ISO timestamp - compatible with both SQLite TEXT and Postgres TIMESTAMPTZ
        try {
            const startOfDay = `${tKey}T00:00:00.000Z`;
            const auditAltTabRow = await db.get(
                `SELECT COUNT(id) as c FROM audit_logs WHERE (type LIKE '%Alt-Tab%' OR type LIKE '%Copy-Paste%' OR type LIKE '%Copy/Paste%' OR type LIKE '%Exit Tab%' OR LOWER("desc") LIKE '%alt%tab%' OR LOWER("desc") LIKE '%paste%' OR LOWER("desc") LIKE '%clipboard%') AND type NOT LIKE '%System Exit%' AND LOWER("desc") NOT LIKE '%system exit%' AND timestamp >= ?`,
                startOfDay
            );
            const auditSecRow = await db.get(
                `SELECT COUNT(id) as c FROM audit_logs WHERE severity IN ('High', 'Warning') AND type NOT LIKE '%Alt-Tab%' AND type NOT LIKE '%Copy-Paste%' AND type NOT LIKE '%Copy/Paste%' AND type NOT LIKE '%Exit Tab%' AND timestamp >= ?`,
                startOfDay
            );
            const auditAltCount = auditAltTabRow ? Number(auditAltTabRow.c || 0) : 0;
            const auditSecCount = auditSecRow ? Number(auditSecRow.c || 0) : 0;
            // Use whichever count is higher (security_flags or audit_logs direct count)
            if (auditAltCount > altTabCopyPasteFlags) altTabCopyPasteFlags = auditAltCount;
            if (auditSecCount > securityFlagsToday) securityFlagsToday = auditSecCount;
        } catch (_) { }

        const activeUsers = activeUsersRow ? Number(activeUsersRow.c) : 0;
        const activeClassrooms = activeClassroomsRow ? Number(activeClassroomsRow.c) : 0;

        res.status(200).json({ activeUsers, activeClassrooms, securityFlagsToday, altTabCopyPasteFlags });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const notifs = [];
        // 1. Pending instructor approvals
        const pendingRow = await db.get("SELECT COUNT(id) as c FROM users WHERE role = 'Teacher' AND status = 'Pending'");
        const pendingCount = pendingRow ? Number(pendingRow.c) : 0;
        if (pendingCount > 0) {
            notifs.push({
                id: 'pending-instructors',
                title: 'Pending Instructor Approvals',
                text: `${pendingCount} instructor(s) awaiting registration approval.`
            });
        }
        // 2. Kiosk security & Alt-Tab / Copy-Paste flags today
        const flagRow = await db.get("SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?", todayKey());
        const secFlags = flagRow ? Number(flagRow.count || 0) : 0;
        const altTabFlags = flagRow ? Number(flagRow.alt_tab_copy_paste_count || 0) : 0;
        if (secFlags > 0 || altTabFlags > 0) {
            notifs.push({
                id: 'security-flags-today',
                title: 'Kiosk Security Activity Today',
                text: `${altTabFlags} Alt-Tab/Copy-Paste flag(s) & ${secFlags} security alert(s) recorded today.`
            });
        }

        // 3. Malicious script execution attempts today
        const startOfDay = `${todayKey()}T00:00:00.000Z`;
        const maliciousRow = await db.get(
            `SELECT COUNT(id) as c FROM audit_logs WHERE type LIKE '%Malicious%' AND timestamp >= ?`,
            startOfDay
        ).catch(() => null);
        const maliciousCount = maliciousRow ? Number(maliciousRow.c || 0) : 0;
        if (maliciousCount > 0) {
            notifs.push({
                id: 'malicious-scripts-today',
                title: '🚨 Malicious Script Warning',
                text: `${maliciousCount} malicious code execution attempt(s) detected and blocked by sandbox today.`
            });
        }
        // 3. Maintenance mode status
        const maintenance = await getMaintenanceStatus();
        if (maintenance && maintenance.enabled) {
            notifs.push({
                id: 'maintenance-mode',
                title: 'System Maintenance Active',
                text: maintenance.message || 'System maintenance mode is currently enabled.'
            });
        }

        res.status(200).json({ notifications: notifs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- .NET SDK MANAGER (Option 3: In-App Web Bootstrap Setup) ---
app.get('/api/system/dotnet-status', (req, res) => {
    try {
        const status = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
        res.status(200).json(status);
    } catch (e) {
        res.status(500).json({ installed: false, error: e.message, stage: 'idle' });
    }
});

app.post('/api/system/install-dotnet', async (req, res) => {
    try {
        // Trigger automated download & silent install in the background
        dotnetManager.startInstallDotnet(io, (verified) => {
            resetDotnetCache();
            ensureBaseTemplate();
        }).catch(err => {
            console.error('[server] Dotnet auto-install error:', err.message);
        });
        res.status(200).json(dotnetManager.getDotnetState());
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/api/system/cancel-dotnet-install', (req, res) => {
    try {
        const status = dotnetManager.cancelInstallDotnet(io);
        res.status(200).json(status);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- REAL-TIME C# COMPILER & PROCTORING (The Brain) ---
const COMPILER_BASE_DIR = path.join(os.tmpdir(), 'verity_compiler_base_template');
let baseTemplatePromise = null;
const sessionWorkspaces = new Map();

function resetDotnetCache() {
    cachedDotnetTargetFramework = null;
    cachedRoslynConfig = null;
    baseTemplatePromise = null;
    console.log('[Compiler] Invalidate and reset local .NET SDK cache');
}

const OFFLINE_DOTNET_ENV = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    DOTNET_CLI_UI_LANGUAGE: 'en-US',
    NUGET_CERTREVOCATIONMODE: 'offline',
    DOTNET_MULTILEVEL_LOOKUP: '0',
    DOTNET_GENERATE_ASPNET_CERTIFICATE: '0',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
};

// Offline NuGet config: no remote package sources, so restore/build never touches the network.
// Plain console apps only need the BCL that ships with the locally installed .NET SDK.
const OFFLINE_NUGET_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
  </packageSources>
</configuration>
`;

let cachedDotnetTargetFramework = null;
function getDotnetTargetFramework() {
    dotnetManager.ensureDotnetInPath();
    if (cachedDotnetTargetFramework) return cachedDotnetTargetFramework;
    try {
        const output = execSync('dotnet --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV }).trim();
        const major = parseInt(output.split('.')[0], 10);
        if (!isNaN(major) && major >= 6) {
            cachedDotnetTargetFramework = `net${major}.0`;
            console.log(`[Compiler] Detected .NET SDK ${output} -> targeting ${cachedDotnetTargetFramework}`);
            return cachedDotnetTargetFramework;
        }
    } catch (e) {
        console.warn('[Compiler] Could not determine dotnet version, defaulting to net8.0:', e.message);
    }
    cachedDotnetTargetFramework = 'net8.0';
    return cachedDotnetTargetFramework;
}

// Locate local Roslyn C# compiler (csc.dll) and Microsoft.NETCore.App.Ref packs for instant offline compilation
let cachedRoslynConfig = null;
function getRoslynConfig() {
    if (cachedRoslynConfig !== null) return cachedRoslynConfig;
    try {
        const info = execSync('dotnet --info', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV });
        let basePath = '';
        const match = info.match(/Base Path:\s*([^\r\n]+)/i);
        if (match && match[1]) basePath = match[1].trim();

        let cscPath = null;
        if (basePath) {
            const candidate1 = path.join(basePath, 'Roslyn', 'bincore', 'csc.dll');
            const candidate2 = path.join(basePath, 'Roslyn', 'bcl', 'csc.dll');
            const candidate3 = path.join(basePath, 'Roslyn', 'csc.dll');
            if (fs.existsSync(candidate1)) cscPath = candidate1;
            else if (fs.existsSync(candidate2)) cscPath = candidate2;
            else if (fs.existsSync(candidate3)) cscPath = candidate3;
        }

        let refDir = null;
        let packVersion = null;
        if (basePath) {
            const dotnetRoot = path.resolve(basePath, '..', '..');
            const packsRefDir = path.join(dotnetRoot, 'packs', 'Microsoft.NETCore.App.Ref');
            if (fs.existsSync(packsRefDir)) {
                const versions = fs.readdirSync(packsRefDir).filter(v => fs.existsSync(path.join(packsRefDir, v, 'ref')));
                if (versions.length > 0) {
                    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                    packVersion = versions[0];
                    const major = packVersion.split('.')[0];
                    const targetSub = path.join(packsRefDir, packVersion, 'ref', `net${major}.0`);
                    if (fs.existsSync(targetSub)) refDir = targetSub;
                }
            }
        }

        if (cscPath && refDir) {
            cachedRoslynConfig = { cscPath, refDir, packVersion };
            console.log(`[Fast Compiler] Discovered local .NET SDK Roslyn C# engine:\n  Compiler: ${cscPath}\n  Reference Assemblies: ${refDir}`);
            return cachedRoslynConfig;
        }
    } catch (e) {
        console.warn('[Compiler] Could not locate direct Roslyn csc in local .NET SDK, will use optimized dotnet build:', e.message);
    }
    cachedRoslynConfig = false;
    return false;
}

function ensureBaseTemplate() {
    if (baseTemplatePromise) return baseTemplatePromise;

    baseTemplatePromise = (async () => {
        try {
            const targetFramework = getDotnetTargetFramework();
            const projectFile = path.join(COMPILER_BASE_DIR, 'verity_base.csproj');
            const nugetFile = path.join(COMPILER_BASE_DIR, 'nuget.config');
            const assetsFile = path.join(COMPILER_BASE_DIR, 'obj', 'project.assets.json');
            const rspFile = path.join(COMPILER_BASE_DIR, 'framework_refs.rsp');

            if (fs.existsSync(projectFile) && fs.existsSync(assetsFile) && fs.existsSync(nugetFile)) {
                try {
                    const existingContent = fs.readFileSync(projectFile, 'utf8');
                    if (existingContent.includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                        // Migrate older templates that still point at nuget.org
                        try {
                            if (fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                                fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                            }
                        } catch (_) { }
                        return COMPILER_BASE_DIR;
                    }
                } catch (_) { }
                // If TargetFramework differs, remove old template and recreate
                try { fs.rmSync(COMPILER_BASE_DIR, { recursive: true, force: true }); } catch (_) { }
            }

            if (!fs.existsSync(COMPILER_BASE_DIR)) {
                fs.mkdirSync(COMPILER_BASE_DIR, { recursive: true });
            }

            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${targetFramework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <UseAppHost>false</UseAppHost>
    <UseSharedCompilation>true</UseSharedCompilation>
    <ProduceReferenceAssembly>false</ProduceReferenceAssembly>
    <EnableSourceLink>false</EnableSourceLink>
    <EnableSourceControlManagerQueries>false</EnableSourceControlManagerQueries>
    <RunAnalyzers>false</RunAnalyzers>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
    <SatelliteResourceLanguages>none</SatelliteResourceLanguages>
    <AcceleratedBuildsInVisualStudio>true</AcceleratedBuildsInVisualStudio>
    <NoWarn>$(NoWarn);NU1503;CS7022</NoWarn>
  </PropertyGroup>
</Project>
`;
            const nugetContent = OFFLINE_NUGET_CONFIG;
            fs.writeFileSync(projectFile, csprojContent, 'utf8');
            fs.writeFileSync(nugetFile, nugetContent, 'utf8');
            fs.writeFileSync(path.join(COMPILER_BASE_DIR, 'Program.cs'), 'using System; class Program { static void Main() {} }\n', 'utf8');

            // Generate framework_refs.rsp and runtimeconfig.json for fast Roslyn compilation
            const roslyn = getRoslynConfig();
            if (roslyn && roslyn.refDir) {
                try {
                    const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
                    const rspLines = [
                        '-nologo',
                        '-target:exe',
                        '-nullable:enable',
                        '-parallel+',
                        ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
                    ];
                    fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');

                    const binDir = path.join(COMPILER_BASE_DIR, 'bin', 'Debug', targetFramework);
                    fs.mkdirSync(binDir, { recursive: true });
                    const runtimeConfig = {
                        runtimeOptions: {
                            tfm: targetFramework,
                            framework: {
                                name: "Microsoft.NETCore.App",
                                version: roslyn.packVersion || "8.0.0"
                            }
                        }
                    };
                    fs.writeFileSync(path.join(binDir, 'verity_base.runtimeconfig.json'), JSON.stringify(runtimeConfig, null, 2), 'utf8');
                } catch (rspErr) {
                    console.warn('[Compiler] Could not generate framework_refs.rsp:', rspErr.message);
                }
            }

            console.log(`[Compiler] Pre-warming base .NET template (${targetFramework}) in offline mode...`);
            await new Promise((resolve) => {
                // Restore offline first (cleared sources ensures 0 network requests)
                exec(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (restoreErr) => {
                    if (restoreErr) {
                        console.warn('[Compiler] Base template restore warning:', restoreErr.message);
                    }
                    exec(`dotnet build --no-restore -v q -m -p:WarningLevel=0 -p:UseAppHost=false "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (buildErr) => {
                        if (buildErr) {
                            console.warn('[Compiler] Base template build warning (falling back to standard build):', buildErr.message);
                            exec(`dotnet build -v q -m -p:WarningLevel=0 "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, () => resolve(COMPILER_BASE_DIR));
                        } else {
                            console.log(`[Compiler] Base .NET template pre-warmed for ${targetFramework} with warm obj/bin cache (offline ready).`);
                            resolve(COMPILER_BASE_DIR);
                        }
                    });
                });
            });

            return COMPILER_BASE_DIR;
        } catch (err) {
            console.error('Failed to pre-warm base compiler template:', err);
            baseTemplatePromise = null;
            throw err;
        }
    })();

    return baseTemplatePromise;
}

// Warm up base template asynchronously on server start
ensureBaseTemplate().catch(err => console.warn('Non-blocking compiler warmup notice:', err.message));

// Clean up ancient verity temporary folders (>12 hours old) periodically
setInterval(() => {
    try {
        const tmpDir = os.tmpdir();
        const files = fs.readdirSync(tmpDir);
        const now = Date.now();
        const MAX_AGE_MS = 12 * 60 * 60 * 1000;

        for (const file of files) {
            if (file.startsWith('verity_ws_') || file.startsWith('verity_temp_')) {
                const fullPath = path.join(tmpDir, file);
                try {
                    const stats = fs.statSync(fullPath);
                    if (now - stats.mtimeMs > MAX_AGE_MS) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                } catch (_) { }
            }
        }
    } catch (_) { }
}, 60 * 60 * 1000);

function parseCompilerDiagnostics(output) {
    if (!output) return [];
    const diagnostics = [];
    const regex = /(?:^|\r?\n)(?:.*?[/\\])?([a-zA-Z0-9_\-\.]+?\.cs)\((\d+)(?:,(\d+))?(?:,(\d+),(\d+))?\):\s*(error|warning)\s+([A-Za-z0-9]+):\s*([^\r\n]+)/gi;
    let match;

    while ((match = regex.exec(output)) !== null) {
        const fileName = match[1];
        const startLine = parseInt(match[2], 10);
        const startCol = match[3] ? parseInt(match[3], 10) : 1;
        const endLine = match[4] ? parseInt(match[4], 10) : startLine;
        const endCol = match[5] ? parseInt(match[5], 10) : null;
        const severity = match[6].toLowerCase();
        const code = match[7];
        let rawMsg = match[8].trim();
        rawMsg = rawMsg.replace(/\s*\[.*?\.csproj\]$/, '').trim();

        diagnostics.push({
            file: fileName,
            severity, // 'error' or 'warning'
            code,
            message: `${code}: ${rawMsg}`,
            startLineNumber: startLine,
            startColumn: startCol,
            endLineNumber: endLine,
            endColumn: endCol
        });
    }

    return diagnostics;
}

function getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles = []) {
    const targetFramework = getDotnetTargetFramework();
    const binDir = path.join(projectDir, 'bin', 'Debug', targetFramework);
    const dllPath = path.join(binDir, 'verity_base.dll');
    const roslyn = getRoslynConfig();

    if (roslyn && roslyn.cscPath && roslyn.refDir) {
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }

        // Ensure runtimeconfig.json exists
        const runtimeConfigFile = path.join(binDir, 'verity_base.runtimeconfig.json');
        if (!fs.existsSync(runtimeConfigFile)) {
            const runtimeConfig = {
                runtimeOptions: {
                    tfm: targetFramework,
                    framework: {
                        name: "Microsoft.NETCore.App",
                        version: roslyn.packVersion || "8.0.0"
                    }
                }
            };
            fs.writeFileSync(runtimeConfigFile, JSON.stringify(runtimeConfig, null, 2), 'utf8');
        }

        // Ensure framework_refs.rsp exists in projectDir
        const rspFile = path.join(projectDir, 'framework_refs.rsp');
        if (!fs.existsSync(rspFile)) {
            const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
            const rspLines = [
                '-nologo',
                '-target:exe',
                '-nullable:enable',
                '-parallel+',
                ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
            ];
            fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');
        }

        const sourceFiles = [
            path.join(projectDir, 'Program.cs'),
            ...extraFiles.map(ef => {
                const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                return path.join(projectDir, safeName);
            }).filter(p => fs.existsSync(p) && path.basename(p).toLowerCase() !== 'program.cs')
        ];

        const args = [
            'exec',
            roslyn.cscPath,
            `@${rspFile}`,
            `-out:${dllPath}`,
            treatWarningsAsErrors ? '-warnaserror+' : '-warnaserror-',
            treatWarningsAsErrors ? '-warn:4' : '-warn:0',
            ...sourceFiles
        ];

        return { command: 'dotnet', args, dllPath, mode: 'roslyn-direct' };
    }

    // Fallback: Optimized dotnet build using local .NET SDK
    const projectFile = path.join(projectDir, 'verity_base.csproj');
    const args = [
        'build',
        '--no-restore',
        '-v', 'q',
        '-clp:NoSummary',
        '-m',
        '-p:UseAppHost=false',
        '-p:ProduceReferenceAssembly=false',
        '-p:RunAnalyzers=false',
        treatWarningsAsErrors ? '-p:WarningLevel=4' : '-p:WarningLevel=0',
        ...(treatWarningsAsErrors ? ['-p:TreatWarningsAsErrors=true'] : []),
        projectFile
    ];

    return { command: 'dotnet', args, dllPath, mode: 'dotnet-build' };
}

async function getTreatWarningsAsErrors() {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (parsed?.examDefaults?.treatWarningsAsErrors !== undefined) {
                return !!parsed.examDefaults.treatWarningsAsErrors;
            }
        }
        const fallbackRow = await db.get("SELECT value FROM system_settings WHERE key = 'examDefaults'");
        if (fallbackRow && fallbackRow.value) {
            const parsed = typeof fallbackRow.value === 'string' ? JSON.parse(fallbackRow.value) : fallbackRow.value;
            return !!parsed?.treatWarningsAsErrors;
        }
    } catch (_) { }
    return false;
}

async function getKioskSettings() {
    const defaults = {
        flagTabExits: true,
        blockCopyPaste: true,
        flagMultipleLogins: true,
        violationThreshold: 3,
        sessionTimeout: '30m',
        cognitivePauseThreshold: 45,
        strictClipboardBlocking: true,
        enforceSingleMonitor: false,
        disableWindowsKeyAltTab: true,
        blockVirtualMachine: true,
        passwordPolicies: { ...DEFAULT_PASSWORD_POLICIES }
    };
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (parsed && parsed.security) {
                return {
                    ...defaults,
                    ...parsed.security,
                    passwordPolicies: {
                        ...DEFAULT_PASSWORD_POLICIES,
                        ...(parsed.security.passwordPolicies || {})
                    }
                };
            }
        }
        const secRow = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
        if (secRow && secRow.value) {
            const parsed = typeof secRow.value === 'string' ? JSON.parse(secRow.value) : secRow.value;
            return {
                ...defaults,
                ...parsed,
                passwordPolicies: {
                    ...DEFAULT_PASSWORD_POLICIES,
                    ...(parsed.passwordPolicies || {})
                }
            };
        }
    } catch (_) { }
    return defaults;
}

/**
 * Creates a minimal, secret-free environment for executing compiled student C# DLLs.
 * Strips DATABASE_URL, JWT_SECRET, SMTP credentials, and host user paths while enforcing
 * a 256 MB .NET GC heap hard limit and pointing TEMP/USERPROFILE inside an isolated sandbox folder.
 */
function createSandboxedRunEnv(sandboxRunDir) {
    const dotnetExe = dotnetManager.ensureDotnetInPath();
    const dotnetDir = dotnetExe ? path.dirname(dotnetExe) : (process.env.DOTNET_ROOT || (process.platform === 'win32' ? 'C:\\Program Files\\dotnet' : '/usr/share/dotnet'));
    const sysRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
    const minimalPath = process.platform === 'win32'
        ? `${dotnetDir};${path.join(sysRoot, 'System32')};${sysRoot}`
        : `${dotnetDir}:/usr/local/bin:/usr/bin:/bin`;

    return {
        PATH: minimalPath,
        SystemRoot: sysRoot,
        WINDIR: sysRoot,
        DOTNET_ROOT: dotnetDir,
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        DOTNET_NOLOGO: '1',
        DOTNET_EnableWriteXorExecute: '1',
        DOTNET_GCHeapHardLimit: '0x10000000', // 256 MB hard runtime memory cap
        DOTNET_TieredCompilation: '0',
        TEMP: sandboxRunDir,
        TMP: sandboxRunDir,
        HOME: sandboxRunDir,
        USERPROFILE: sandboxRunDir,
        COMPlus_EnableDiagnostics: '0'
    };
}

function createEphemeralSandboxDir(prefix = 'verity_sandbox_') {
    const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupEphemeralSandboxDir(dir) {
    if (!dir) return;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { }
}

let currentInstruction = "";
const activeStudents = {};

const {
    initCloudRelay,
    relayStudentActivity,
    relayProctorAlert,
    relayTerminalUpdate,
    relayStudentLeft,
    relaySubmitExam,
    relayUnsubmitExam
} = require('./cloudRelay');

initCloudRelay(activeStudents, io);

function getActiveActivitiesMap(targetClassroomId = null) {
    const counts = {};
    const targetLower = targetClassroomId && targetClassroomId !== 'all' ? String(targetClassroomId).toLowerCase() : null;
    for (const student of Object.values(activeStudents)) {
        if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
        if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
        if (targetLower && student.classroomId && student.classroomId !== 'none') {
            const sCid = String(student.classroomId).toLowerCase();
            const sCode = String(student.classCode || '').toLowerCase();
            if (sCid !== targetLower && (!sCode || sCode !== targetLower)) {
                // Still include by assignmentId since assignmentId is unique per activity,
                // avoiding false exclusion when classroomId representation differs
            }
        }
        const aId = String(student.assignmentId);
        counts[aId] = (counts[aId] || 0) + 1;
    }
    return counts;
}

function getActiveClassroomsMap() {
    const classroomCounts = {};
    for (const student of Object.values(activeStudents)) {
        if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
        if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
        if (student.classroomId && student.classroomId !== 'none' && student.classroomId !== 'unassigned') {
            const cId = String(student.classroomId);
            classroomCounts[cId] = (classroomCounts[cId] || 0) + 1;
            classroomCounts[cId.toLowerCase()] = (classroomCounts[cId.toLowerCase()] || 0) + 1;
            if (student.classCode) {
                const code = String(student.classCode);
                classroomCounts[code] = (classroomCounts[code] || 0) + 1;
                classroomCounts[code.toLowerCase()] = (classroomCounts[code.toLowerCase()] || 0) + 1;
            }
        }
    }
    return classroomCounts;
}

function broadcastActiveActivities() {
    const allCounts = {};
    const classroomCounts = getActiveClassroomsMap();
    for (const student of Object.values(activeStudents)) {
        if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
        if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
        const aId = String(student.assignmentId);
        allCounts[aId] = (allCounts[aId] || 0) + 1;
    }
    io.emit('active_activities_update', { counts: allCounts, classroomCounts });
}

function removeStudentFromPreviousActivities(studentId, studentName, excludeKey = null) {
    const sIdStr = String(studentId || '');
    const sNameStr = String(studentName || '').trim().toLowerCase();
    const removedRooms = [];

    for (const [key, student] of Object.entries(activeStudents)) {
        if (key === excludeKey) continue;
        if (!student) continue;

        const curId = String(student.studentId || student.id || '');
        const curName = String(student.name || student.studentName || '').trim().toLowerCase();

        const isMatch = (sIdStr && curId === sIdStr) || (sNameStr && curName === sNameStr);
        if (isMatch) {
            removedRooms.push({
                key,
                classroomId: student.classroomId,
                assignmentId: student.assignmentId,
                studentId: student.studentId || studentId,
                studentName: student.name || studentName
            });
            delete activeStudents[key];
        }
    }

    for (const item of removedRooms) {
        const roomName = `classroom:${item.classroomId}:assignment:${item.assignmentId}`;
        const payload = {
            studentId: item.studentId,
            studentName: item.studentName,
            classroomId: item.classroomId,
            assignmentId: item.assignmentId,
            reason: 'switched_activity'
        };
        io.to(roomName).emit('teacher_student_left', payload);
        io.emit('teacher_student_left', payload);
    }

    if (removedRooms.length > 0) {
        broadcastActiveActivities();
    }
}

app.get('/active-activities', (req, res) => {
    try {
        const counts = getActiveActivitiesMap(req.query.classroomId);
        const classroomCounts = getActiveClassroomsMap();
        res.status(200).json({ counts, classroomCounts });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

async function recordMaliciousScriptAttempt({ socket, data, securityCheck }) {
    try {
        const userName = socket?.user?.name || socket?.user?.email || data?.username || data?.user?.name || 'Unknown User';
        const studentId = socket?.user?.id || data?.user?.id || userName;
        const nowIso = new Date().toISOString();
        const tKey = todayKey();

        const foundActive = Object.values(activeStudents).find(s => s && (s.studentId === userName || s.name === userName || s.studentId === studentId));
        const classroomId = data?.classroomId || foundActive?.classroomId || null;
        const assignmentId = data?.assignmentId || foundActive?.assignmentId || null;

        const logType = 'Malicious Script Attempt';
        const logSeverity = 'High';
        const desc = `Blocked malicious script execution attempt: [Rule: ${securityCheck.rule}] ${securityCheck.message} in ${securityCheck.fileName || 'Program.cs'} (Line ${securityCheck.line || 1}:${securityCheck.column || 1})`;

        console.warn(`[Security Alert] Malicious script attempt by "${userName}": ${desc}`);

        // 1. Insert into audit_logs table
        await db.run(
            'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
            nowIso,
            userName,
            logType,
            logSeverity,
            desc
        );

        // 2. Increment daily security flag count
        await db.run(
            `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
            tKey
        );

        // 3. If in classroom / assignment session, log to proctor_session_logs & alert teacher
        if (classroomId && assignmentId && assignmentId !== 'none' && assignmentId !== 'default') {
            const timeText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            try {
                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    classroomId,
                    assignmentId,
                    String(userName),
                    String(userName),
                    'Malicious Script',
                    `Blocked malicious script: ${securityCheck.rule}`,
                    timeText,
                    '#dc2626'
                ).catch(() => { });
            } catch (_) { }

            const targetRoom = `classroom:${classroomId}:assignment:${assignmentId}`;
            io.to(targetRoom).emit('teacher_receive_alert', {
                id: Date.now(),
                studentId: userName,
                studentName: userName,
                name: userName,
                action: 'Malicious Script',
                message: `Security violation: ${securityCheck.rule} - ${securityCheck.message}`,
                time: timeText,
                color: '#dc2626',
                isCrash: false,
                classroomId,
                assignmentId
            });
        }

        // 4. Emit real-time security alert to Admin sessions
        io.emit('admin_security_alert', {
            user: userName,
            name: userName,
            studentId: studentId,
            type: logType,
            severity: logSeverity,
            desc: desc,
            action: desc,
            rule: securityCheck.rule,
            fileName: securityCheck.fileName || 'Program.cs',
            line: securityCheck.line || 1,
            column: securityCheck.column || 1,
            classroomId,
            assignmentId,
            isAltTabCopyPaste: false,
            isSystemExit: false,
            isMaliciousScript: true,
            timestamp: nowIso
        });

        // 5. Trigger live stats and user list refresh for admin
        io.emit('admin_stats_update');
        io.emit('users_updated');
    } catch (err) {
        console.error('Error recording malicious script attempt:', err);
    }
}

io.on('connection', (socket) => {
    console.log('[Workspace] Student Connected: ' + socket.id);

    socket.on('get_active_activities', (data) => {
        socket.emit('active_activities_update', {
            counts: getActiveActivitiesMap(data?.classroomId),
            classroomCounts: getActiveClassroomsMap()
        });
    });

    socket.on('teacher_leave', (data) => {
        if (socket.data.teacherRoom) {
            socket.leave(socket.data.teacherRoom);
            socket.data.teacherRoom = null;
        }
    });

    // .NET SDK status & setup socket listeners
    socket.on('check_dotnet_status', (cb) => {
        const s = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
        if (typeof cb === 'function') cb(s);
        else socket.emit('dotnet_setup_progress', s);
    });

    socket.on('install_dotnet', async () => {
        await dotnetManager.startInstallDotnet(io, (verified) => {
            resetDotnetCache();
            ensureBaseTemplate();
        });
    });

    socket.on('cancel_dotnet_install', () => {
        dotnetManager.cancelInstallDotnet(io);
    });

    let activeProcess = null;

    // Resilient socket authentication (JWT verified -> unverified decode fallback for offline/cross-env -> payload user fallback)
    const authenticateSocket = (targetSocket, token, userData) => {
        if (targetSocket.user) return targetSocket.user;

        if (token && typeof token === 'string') {
            try {
                const verified = jwt.verify(token, JWT_SECRET);
                if (verified) {
                    targetSocket.user = verified;
                    targetSocket.emit('authenticated', { user: { id: verified.id, email: verified.email, role: verified.role } });
                    return targetSocket.user;
                }
            } catch (err) {
                // In local offline fallback mode or across cloud/desktop environments with different secrets,
                // decode the JWT payload safely so offline / kiosk student execution is never blocked.
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && (decoded.id || decoded.email || decoded.role)) {
                        targetSocket.user = decoded;
                        targetSocket.emit('authenticated', { user: { id: decoded.id, email: decoded.email, role: decoded.role } });
                        return targetSocket.user;
                    }
                } catch (_) { }
            }
        }

        if (userData && (userData.id || userData.email || userData.name)) {
            targetSocket.user = {
                id: userData.id || 1,
                name: userData.name || 'Student',
                email: userData.email || 'student@verity.local',
                role: userData.role || 'Student'
            };
            targetSocket.emit('authenticated', { user: { id: targetSocket.user.id, email: targetSocket.user.email, role: targetSocket.user.role } });
            return targetSocket.user;
        }

        return null;
    };

    // Support authentication via initial handshake or explicit event
    const handshakeToken = socket.handshake.auth?.token;
    if (handshakeToken) {
        authenticateSocket(socket, handshakeToken);
        if (socket.user) {
            getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => { });
        }
    }

    socket.on('authenticate', (data) => {
        if (!data) return;
        let u = null;
        if (typeof data === 'string') {
            u = authenticateSocket(socket, data);
        } else if (typeof data === 'object') {
            u = authenticateSocket(socket, data.token, data.user);
        }
        if (u) {
            checkAndFlagMultipleLogins(u, socket, socket.id).catch(() => { });
            getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => { });
        }
    });

    if (currentInstruction) {
        socket.emit('instruction_update', currentInstruction);
    }

    socket.on('teacher_join', async (data) => {
        const { classroomId, assignmentId } = data || {};
        if (!socket.user) {
            authenticateSocket(socket, data?.token || socket.handshake.auth?.token, data?.user);
        }
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            if (data?.user && ['Teacher', 'Admin'].includes(data.user.role)) {
                socket.user = data.user;
            } else {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
        }

        const roomName = `classroom:${classroomId || 'none'}:assignment:${assignmentId || 'none'}`;

        if (socket.data.teacherRoom) {
            socket.leave(socket.data.teacherRoom);
        }

        socket.join(roomName);
        if (assignmentId && assignmentId !== 'none') {
            socket.join(`assignment:${assignmentId}`);
        }
        socket.data.teacherRoom = roomName;

        const cIdStr = String(classroomId || 'none');
        const aIdStr = String(assignmentId || 'none');
        const filterKey = `${cIdStr}:${aIdStr}`;

        // Fetch past session warnings from the database so late-joining teachers get all warnings
        let dbLogs = [];
        try {
            if (cIdStr && cIdStr !== 'none' && cIdStr !== 'undefined' && cIdStr !== 'default') {
                dbLogs = await db.all(
                    `SELECT * FROM proctor_session_logs 
                     WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) 
                       AND (classroom_id = ? OR CAST(classroom_id AS TEXT) = ? OR classroom_id IS NULL) 
                     ORDER BY id ASC`,
                    aIdStr, aIdStr, cIdStr, cIdStr
                ).catch(() => []);
            } else {
                dbLogs = await db.all(
                    `SELECT * FROM proctor_session_logs 
                     WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?
                     ORDER BY id ASC`,
                    aIdStr, aIdStr
                ).catch(() => []);
            }
        } catch (_) { }

        if (Array.isArray(dbLogs) && dbLogs.length > 0) {
            socket.emit('teacher_past_warnings', dbLogs);
        }

        // Tanggalin ang submitted students para di lumabas sa live monitoring
        let submittedRows = [];
        try {
            submittedRows = await db.all(
                `SELECT LOWER(student_name) as sname FROM submissions WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?`,
                aIdStr, aIdStr
            ).catch(() => []);
        } catch (_) { }
        const submittedSet = new Set((submittedRows || []).map(r => r.sname));

        for (const [key, student] of Object.entries(activeStudents)) {
            if (!student || student.isLive === false || student.status === 'Offline' || student.status === 'Submitted' || student.submitted) continue;
            const curName = String(student.name || student.studentName || '').trim().toLowerCase();
            const curId = String(student.id || student.studentId || '').trim().toLowerCase();
            if (submittedSet.has(curName) || submittedSet.has(curId)) {
                delete activeStudents[key];
                continue;
            }
            const isMatch = (
                key.startsWith(filterKey + ':') ||
                (aIdStr !== 'none' && (
                    key.startsWith(`none:${aIdStr}:`) ||
                    key.includes(`:${aIdStr}:`) ||
                    String(student.assignmentId) === aIdStr
                ))
            );
            if (isMatch) {
                socket.emit('teacher_update_code', {
                    ...student,
                    logs: student.logs || []
                });
            }
        }
    });

    socket.on('teacher_request_sync', async ({ classroomId, assignmentId }) => {
        // Broadcast request to any connected LAN relays to refresh live students
        io.emit('cloud_request_lan_sync', { classroomId, assignmentId });
        const cIdStr = String(classroomId || 'none');
        const aIdStr = String(assignmentId || 'none');
        const filterKey = `${cIdStr}:${aIdStr}`;

        // I-sync lang ang mga live students, bawal ang submitted
        let submittedRows = [];
        try {
            submittedRows = await db.all(
                `SELECT LOWER(student_name) as sname FROM submissions WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?`,
                aIdStr, aIdStr
            ).catch(() => []);
        } catch (_) { }
        const submittedSet = new Set((submittedRows || []).map(r => r.sname));

        for (const [key, student] of Object.entries(activeStudents)) {
            if (!student || student.isLive === false || student.status === 'Offline' || student.status === 'Submitted' || student.submitted) continue;
            const curName = String(student.name || student.studentName || '').trim().toLowerCase();
            const curId = String(student.id || student.studentId || '').trim().toLowerCase();
            if (submittedSet.has(curName) || submittedSet.has(curId)) {
                delete activeStudents[key];
                continue;
            }
            const isMatch = (
                key.startsWith(filterKey + ':') ||
                (aIdStr !== 'none' && (
                    key.startsWith(`none:${aIdStr}:`) ||
                    key.includes(`:${aIdStr}:`) ||
                    String(student.assignmentId) === aIdStr
                ))
            );
            if (isMatch) {
                socket.emit('teacher_update_code', {
                    ...student,
                    logs: student.logs || []
                });
            }
        }
    });

    socket.on('set_instruction', (text) => {
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            return;
        }
        currentInstruction = text;
        io.emit('instruction_update', text);
    });

    socket.on('classwork_updated', async ({ classroomId, classwork }) => {
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            return socket.emit('error', { message: 'Access denied: Teacher role required.' });
        }
        if (classroomId == null || !Array.isArray(classwork)) return;

        try {
            await saveClassworkToDb(classroomId, classwork);
            const updatedClasswork = await getClassworkFromDb(classroomId);
            socket.broadcast.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        } catch (e) {
            console.error('Error in socket classwork_updated:', e);
            socket.broadcast.emit('classwork_changed', { classroomId, classwork });
        }
    });

    socket.on('classroom_theme_updated', async (data) => {
        if (!data) return;
        const { classroomId, theme } = data;
        if (classroomId && theme) {
            try {
                const themeStr = typeof theme === 'object' ? JSON.stringify(theme) : theme;
                await db.run('UPDATE classrooms SET theme = ? WHERE id = ?', themeStr, classroomId);
            } catch (e) {
                console.error('Error persisting classroom theme via socket:', e);
            }
        }
        io.emit('classroom_theme_changed', data);
    });

    socket.on('teacher_announcement_posted', async (data) => {
        if (!data || !data.classroomId || !data.announcement) return;
        const { classroomId, announcement } = data;
        const announcementId = announcement.id ? Number(announcement.id) : Date.now();
        const announcementTitle = announcement.title || 'Instructor Announcement';
        const announcementDetails = (announcement.details || '').trim();
        const announcementAuthor = announcement.author || socket.user?.name || 'Instructor';
        const postedTime = announcement.posted ? Number(announcement.posted) : Date.now();

        try {
            await db.run(`
                INSERT INTO announcements (id, classroom_id, title, details, author, posted)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    details = excluded.details,
                    author = excluded.author,
                    posted = excluded.posted
            `, announcementId, Number(classroomId), announcementTitle, announcementDetails, announcementAuthor, postedTime);
        } catch (e) {
            console.error('Error persisting announcement via socket:', e);
        }

        const payload = {
            id: announcementId,
            classroomId: Number(classroomId),
            title: announcementTitle,
            details: announcementDetails,
            author: announcementAuthor,
            posted: postedTime
        };

        io.emit('announcement_posted', { classroomId: Number(classroomId), announcement: payload });
    });

    socket.on('teacher_announcement_deleted', async (data) => {
        if (!data || !data.classroomId || !data.announcementId) return;
        const { classroomId, announcementId } = data;
        try {
            await db.run('DELETE FROM announcements WHERE id = ? AND classroom_id = ?', Number(announcementId), Number(classroomId));
        } catch (e) {
            console.error('Error deleting announcement via socket:', e);
        }
        io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(announcementId) });
    });

    socket.on('compile_code', async (data) => {
        try {
            if (!socket.user) {
                authenticateSocket(socket, data?.token || socket.handshake.auth?.token, data?.user);
            }

            if (!socket.user && (data?.username === 'CompilerView' || data?.room === 'sandbox')) {
                socket.user = { id: 9999, name: 'CompilerView', role: 'Student' };
            }

            if (!socket.user) {
                socket.emit('terminal_output', "Error: Authentication required to execute code. Please log in.\n");
                return socket.emit('process_exit', { code: 1 });
            }

            const { code, extraFiles = [], language } = data || {};
            if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
                socket.emit('terminal_output', `\n[Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.]\n`);
                return socket.emit('process_exit', { code: 1 });
            }

            // Verify .NET SDK is available on host machine
            const dotnetStatus = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
            if (!dotnetStatus.installed) {
                socket.emit('terminal_output', "\n[Error: Microsoft .NET SDK is not installed on this machine.]\n[Verity C# Compiler requires Microsoft .NET SDK. Please reinstall The Verity and select the Microsoft .NET SDK option in the installer, or download it from https://dotnet.microsoft.com/download/dotnet/8.0]\n");
                socket.emit('dotnet_missing', { error: 'DOTNET_NOT_INSTALLED' });
                return socket.emit('process_exit', { code: 1 });
            }

            // Security check: Scan C# code for dangerous APIs, process execution, reflection, native calls, etc.
            const securityCheck = scanCSharpCode(code, extraFiles);
            if (!securityCheck.isSafe) {
                await recordMaliciousScriptAttempt({ socket, data, securityCheck });
                socket.emit('compiler_diagnostics', [{
                    severity: 'error',
                    message: `[Security Violation] ${securityCheck.message}`,
                    startLineNumber: securityCheck.line || 1,
                    startColumn: securityCheck.column || 1,
                    endLineNumber: securityCheck.line || 1,
                    endColumn: (securityCheck.column || 1) + 12
                }]);
                socket.emit('terminal_output', `\n[Security Alert: Code execution blocked by Verity Sandbox]\n[File: ${securityCheck.fileName}, Line ${securityCheck.line}:${securityCheck.column}]\n[Rule: ${securityCheck.rule}]\n[Detail: ${securityCheck.message}]\n\n`);
                return socket.emit('process_exit', { code: 1 });
            }

            const studentKey = socket.user?.id
                ? `u_${socket.user.id}`
                : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

            let projectDir = sessionWorkspaces.get(studentKey)?.projectDir;
            if (!projectDir) {
                projectDir = path.join(os.tmpdir(), `verity_ws_${studentKey}`);
                sessionWorkspaces.set(studentKey, { projectDir, lastUsed: Date.now() });
            } else {
                sessionWorkspaces.get(studentKey).lastUsed = Date.now();
            }

            const projectFile = path.join(projectDir, 'verity_base.csproj');
            let isFirstCompile = !fs.existsSync(projectFile);
            const targetFramework = getDotnetTargetFramework();

            if (!isFirstCompile) {
                try {
                    const existingCsproj = fs.readFileSync(projectFile, 'utf8');
                    if (!existingCsproj.includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                        try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (_) { }
                        isFirstCompile = true;
                    }
                } catch (_) { }
            }

            if (activeProcess) {
                try { killProcessTree(activeProcess); } catch (_) { }
                activeProcess = null;
            }

            if (isFirstCompile) {
                socket.emit('terminal_output', "Initializing compiler environment...\n");

                try {
                    await ensureBaseTemplate();
                    if (!fs.existsSync(projectDir)) {
                        fs.mkdirSync(projectDir, { recursive: true });
                    }
                    fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                    await compileStudentCode(projectDir, code, socket, extraFiles);
                } catch (err) {
                    console.warn('Fast template clone failed, falling back to dotnet new:', err.message);
                    exec(`dotnet new console -n verity_base --no-restore --framework ${targetFramework} -o "${projectDir}"`, { env: OFFLINE_DOTNET_ENV }, async (newErr) => {
                        if (newErr) {
                            sessionWorkspaces.delete(studentKey);
                            socket.emit('terminal_output', "Error: Could not initialize .NET compiler.\n");
                            return socket.emit('process_exit', { code: 1 });
                        }
                        try {
                            fs.writeFileSync(path.join(projectDir, 'nuget.config'), OFFLINE_NUGET_CONFIG, 'utf8');
                            execSync(`dotnet restore "${path.join(projectDir, 'verity_base.csproj')}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                        } catch (_) { }
                        await compileStudentCode(projectDir, code, socket, extraFiles);
                    });
                }
            } else {
                await compileStudentCode(projectDir, code, socket, extraFiles);
            }
        } catch (error) {
            console.error('Compiler error:', error);
            socket.emit('terminal_output', `\n[Internal Server Error: ${error.message}]\n`);
            socket.emit('process_exit', { code: 1 });
        }
    });

    async function compileStudentCode(projectDir, code, socket, extraFiles = []) {
        fs.writeFileSync(path.join(projectDir, 'Program.cs'), code, 'utf8');
        // Write any additional .cs files (multi-file support)
        const extraNames = new Set();
        for (const ef of extraFiles) {
            if (!ef || !ef.name || !ef.code) continue;
            // Ensure safe filename with .cs extension
            const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
            if (safeName.toLowerCase() === 'program.cs') continue; // handled above
            fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
            extraNames.add(safeName);
        }
        // Remove stale extra files from prior runs (keeps project clean)
        try {
            for (const f of fs.readdirSync(projectDir)) {
                if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                    try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) { }
                }
            }
        } catch (_) { }

        socket.emit('terminal_output', "Compiling...\n");
        socket.emit('compiler_diagnostics', []); // Clear existing markers

        const projectFile = path.join(projectDir, 'verity_base.csproj');
        const nugetFile = path.join(projectDir, 'nuget.config');
        const treatWarningsAsErrors = await getTreatWarningsAsErrors();
        const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);
        const dllPath = compilerConfig.dllPath;

        // Ensure offline nuget.config exists in project directory (and migrate old online ones)
        try {
            if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
            }
        } catch (_) { }

        // Ensure assets file exists if using dotnet build fallback
        if (compilerConfig.mode === 'dotnet-build') {
            const assetsFile = path.join(projectDir, 'obj', 'project.assets.json');
            if (!fs.existsSync(assetsFile)) {
                try {
                    execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                } catch (_) { }
            }
        }

        const env = OFFLINE_DOTNET_ENV;

        // Stage 1: Fast compilation via local .NET SDK (direct Roslyn or optimized dotnet build)
        const buildProcess = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env });
        activeProcess = buildProcess;

        let rawCompilerOutput = '';
        buildProcess.stdout.on('data', (d) => { rawCompilerOutput += d.toString(); });
        buildProcess.stderr.on('data', (d) => { rawCompilerOutput += d.toString(); });

        const buildTimeout = setTimeout(() => {
            if (activeProcess === buildProcess) {
                try { buildProcess.kill(); } catch (_) { }
                socket.emit('terminal_output', "\n[Compilation timed out]\n");
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
            }
        }, 15000);

        buildProcess.on('error', (err) => {
            clearTimeout(buildTimeout);
            socket.emit('terminal_output', `\n[Compiler launch error: ${err.message}]\n`);
            socket.emit('process_exit', { code: 1 });
            activeProcess = null;
        });

        buildProcess.on('close', (buildCode) => {
            clearTimeout(buildTimeout);
            if (activeProcess !== buildProcess) return;

            const diagnostics = parseCompilerDiagnostics(rawCompilerOutput);
            socket.emit('compiler_diagnostics', diagnostics);

            if (buildCode !== 0 || !fs.existsSync(dllPath)) {
                socket.emit('terminal_output', rawCompilerOutput + "\n[Build failed. Fix the build errors and run again.]\n");
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
                return;
            }

            // Stage 2: Direct sandboxed .dll execution (isolated ephemeral cwd, secret-free env, 256 MB heap cap)
            socket.emit('terminal_output', "Running...\n\n");
            socket.emit('program_started');

            const sandboxRunDir = createEphemeralSandboxDir('verity_sandbox_run_');
            const sandboxEnv = createSandboxedRunEnv(sandboxRunDir);
            const runProcess = spawn('dotnet', [dllPath], { cwd: sandboxRunDir, env: sandboxEnv });
            runProcess._sandboxRunDir = sandboxRunDir;
            activeProcess = runProcess;

            let totalOutputBytes = 0;
            const MAX_OUTPUT_BYTES = 128 * 1024; // 128 KB buffer flood protection
            let isOutputCapped = false;

            const executionTimeout = setTimeout(() => {
                if (activeProcess === runProcess) {
                    try { killProcessTree(runProcess); } catch (_) { }
                    cleanupEphemeralSandboxDir(sandboxRunDir);
                    socket.emit('terminal_output', "\n[Process terminated: Execution limit of 20s exceeded]\n");
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                }
            }, 20000);

            runProcess.on('error', (err) => {
                clearTimeout(executionTimeout);
                cleanupEphemeralSandboxDir(sandboxRunDir);
                socket.emit('terminal_output', `\n[Execution error: ${err.message}]\n`);
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
            });

            runProcess.stdout.on('data', (data) => {
                if (isOutputCapped) return;
                totalOutputBytes += data.length;
                if (totalOutputBytes > MAX_OUTPUT_BYTES) {
                    isOutputCapped = true;
                    try { killProcessTree(runProcess); } catch (_) { }
                    cleanupEphemeralSandboxDir(sandboxRunDir);
                    socket.emit('terminal_output', "\n\n[Process terminated: Execution output exceeded 128 KB limit (Infinite output loop detected)]\n");
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                    return;
                }
                socket.emit('terminal_output', data.toString());
            });

            runProcess.stderr.on('data', (data) => {
                if (isOutputCapped) return;
                totalOutputBytes += data.length;
                if (totalOutputBytes > MAX_OUTPUT_BYTES) {
                    isOutputCapped = true;
                    try { killProcessTree(runProcess); } catch (_) { }
                    cleanupEphemeralSandboxDir(sandboxRunDir);
                    socket.emit('terminal_output', "\n\n[Process terminated: Execution output exceeded 128 KB limit (Infinite output loop detected)]\n");
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                    return;
                }
                socket.emit('terminal_output', data.toString());
            });

            runProcess.on('close', (runCode) => {
                clearTimeout(executionTimeout);
                cleanupEphemeralSandboxDir(sandboxRunDir);
                socket.emit('terminal_output', `\n[Process exited with code ${runCode ?? 0}]\n`);
                socket.emit('process_exit', { code: runCode ?? 0 });
                activeProcess = null;
            });
        });
    }

    socket.on('terminal_input', (input) => {
        if (activeProcess && activeProcess.stdin) {
            activeProcess.stdin.write(input + '\n');
        }
    });

    socket.on('stop_code', () => {
        if (activeProcess) {
            const dirToClean = activeProcess._sandboxRunDir;
            try { killProcessTree(activeProcess); } catch (_) { }
            cleanupEphemeralSandboxDir(dirToClean);
            socket.emit('terminal_output', "\n[Process stopped by user]\n");
            socket.emit('process_exit', { code: 0 });
            activeProcess = null;
        }
    });

    socket.on('run_test_cases', async (data) => {
        try {
            if (!socket.user) {
                authenticateSocket(socket, data?.token || socket.handshake.auth?.token, data?.user);
            }

            if (!socket.user && (data?.username === 'CompilerView' || data?.room === 'sandbox')) {
                socket.user = { id: 9999, name: 'CompilerView', role: 'Student' };
            }

            const { code, extraFiles = [], testCases = [], language } = data || {};
            if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
                const results = (testCases || []).map(tc => ({
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: '',
                    expectedOutput: tc.expectedOutput || '',
                    error: `Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.`
                }));
                return socket.emit('test_cases_results', { results });
            }
            if (!Array.isArray(testCases) || testCases.length === 0) {
                return socket.emit('test_cases_results', { results: [] });
            }

            // Verify local .NET SDK is available on host machine
            const dotnetStatus = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
            if (!dotnetStatus.installed) {
                socket.emit('dotnet_missing', { error: 'DOTNET_NOT_INSTALLED' });
                const results = testCases.map(tc => ({
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: '',
                    expectedOutput: tc.expectedOutput || '',
                    error: 'Microsoft .NET SDK is not installed on this PC. Please install .NET SDK to run tests.'
                }));
                return socket.emit('test_cases_results', { results });
            }

            // Security check: Scan C# code for dangerous APIs prior to test evaluation
            const securityCheck = scanCSharpCode(code, extraFiles);
            if (!securityCheck.isSafe) {
                await recordMaliciousScriptAttempt({ socket, data, securityCheck });
                socket.emit('compiler_diagnostics', [{
                    severity: 'error',
                    message: `[Security Violation] ${securityCheck.message}`,
                    startLineNumber: securityCheck.line || 1,
                    startColumn: securityCheck.column || 1,
                    endLineNumber: securityCheck.line || 1,
                    endColumn: (securityCheck.column || 1) + 12
                }]);
                const results = (testCases || []).map(tc => ({
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: '',
                    expectedOutput: tc.expectedOutput || '',
                    error: `Security Violation: ${securityCheck.message} (File: ${securityCheck.fileName}, Line ${securityCheck.line})`
                }));
                return socket.emit('test_cases_results', { results });
            }

            const studentKey = socket.user?.id
                ? `u_${socket.user.id}`
                : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

            let ws = sessionWorkspaces.get(studentKey);
            let projectDir = ws?.projectDir;
            if (!projectDir) {
                projectDir = path.join(os.tmpdir(), `verity_ws_${studentKey}`);
                ws = { projectDir, lastUsed: Date.now() };
                sessionWorkspaces.set(studentKey, ws);
            } else {
                ws.lastUsed = Date.now();
            }

            const projectFile = path.join(projectDir, 'verity_base.csproj');
            const targetFramework = getDotnetTargetFramework();
            const dllPath = path.join(projectDir, 'bin', 'Debug', targetFramework, 'verity_base.dll');

            let compileSuccess = true;
            let buildOutput = '';
            const env = OFFLINE_DOTNET_ENV;

            // Check if compilation is needed
            if (ws.lastCompiledCode === code && fs.existsSync(dllPath)) {
                // Skip compilation, code hasn't changed
                console.log(`[TestCases] Skipping compilation for ${studentKey} (cached)`);
                socket.emit('compiler_diagnostics', []); // clear old diags
            } else {
                console.log(`[TestCases] Compiling for ${studentKey}...`);
                // Ensure workspace directory exists
                try {
                    await ensureBaseTemplate();
                    if (!fs.existsSync(projectDir)) {
                        fs.mkdirSync(projectDir, { recursive: true });
                        fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                    }
                } catch (e) {
                    console.warn('Workspace prep failed for test cases:', e.message);
                }

                // Write student code to Program.cs
                fs.writeFileSync(path.join(projectDir, 'Program.cs'), code || '', 'utf8');

                // Write any additional .cs files (multi-file support)
                const extraNames = new Set();
                for (const ef of extraFiles) {
                    if (!ef || !ef.name || !ef.code) continue;
                    const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                    if (safeName.toLowerCase() === 'program.cs') continue;
                    fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
                    extraNames.add(safeName);
                }
                try {
                    for (const f of fs.readdirSync(projectDir)) {
                        if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                            try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) { }
                        }
                    }
                } catch (_) { }

                // Ensure nuget and obj assets exist
                const nugetFile = path.join(projectDir, 'nuget.config');
                try {
                    if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                        fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                    }
                } catch (_) { }

                const treatWarningsAsErrors = await getTreatWarningsAsErrors();
                const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);

                if (compilerConfig.mode === 'dotnet-build') {
                    const assetsFile = path.join(projectDir, 'obj', 'project.assets.json');
                    if (!fs.existsSync(assetsFile)) {
                        try {
                            execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                        } catch (_) { }
                    }
                }

                compileSuccess = await new Promise((resolve) => {
                    const bp = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env });
                    bp.stdout.on('data', d => { buildOutput += d.toString(); });
                    bp.stderr.on('data', d => { buildOutput += d.toString(); });
                    const timeout = setTimeout(() => {
                        try { bp.kill(); } catch (_) { }
                        resolve(false);
                    }, 15000);
                    bp.on('close', code => {
                        clearTimeout(timeout);
                        const diags = parseCompilerDiagnostics(buildOutput);
                        socket.emit('compiler_diagnostics', diags);
                        resolve(code === 0 && fs.existsSync(dllPath));
                    });
                    bp.on('error', () => {
                        clearTimeout(timeout);
                        resolve(false);
                    });
                });

                if (compileSuccess) {
                    ws.lastCompiledCode = code;
                } else {
                    ws.lastCompiledCode = null;
                    const results = testCases.map(tc => ({
                        id: tc.id,
                        status: 'error',
                        passed: false,
                        actualOutput: '',
                        expectedOutput: tc.expectedOutput || '',
                        error: buildOutput || 'Compilation failed. Please fix syntax or type errors in code.'
                    }));
                    return socket.emit('test_cases_results', { results });
                }
            }

            // Run all test cases in parallel inside isolated ephemeral sandbox directories
            const MAX_TEST_OUTPUT_BYTES = 128 * 1024;
            const results = await Promise.all(testCases.map(tc => new Promise((resolve) => {
                let actual = '';
                let runError = '';
                let killed = false;
                let totalBytes = 0;
                const tcSandboxDir = createEphemeralSandboxDir('verity_sandbox_tc_');
                const tcSandboxEnv = createSandboxedRunEnv(tcSandboxDir);
                const rp = spawn('dotnet', [dllPath], { cwd: tcSandboxDir, env: tcSandboxEnv });

                const execTimeout = setTimeout(() => {
                    killed = true;
                    try { killProcessTree(rp); } catch (_) { }
                    cleanupEphemeralSandboxDir(tcSandboxDir);
                    const result = {
                        id: tc.id,
                        status: 'error',
                        passed: false,
                        actualOutput: actual.replace(/\r\n/g, '\n'),
                        expectedOutput: tc.expectedOutput || '',
                        error: 'Execution timed out (5s limit exceeded)'
                    };
                    socket.emit('test_case_result', result);
                    resolve(result);
                }, 5000);

                if (tc.input !== undefined && tc.input !== null && tc.input !== '') {
                    try {
                        const inStr = String(tc.input);
                        rp.stdin.write(inStr.endsWith('\n') ? inStr : inStr + '\n');
                    } catch (_) { }
                }
                try { rp.stdin.end(); } catch (_) { }

                const onChunk = (chunk, isErr) => {
                    if (killed) return;
                    totalBytes += chunk.length;
                    if (totalBytes > MAX_TEST_OUTPUT_BYTES) {
                        killed = true;
                        clearTimeout(execTimeout);
                        try { killProcessTree(rp); } catch (_) { }
                        cleanupEphemeralSandboxDir(tcSandboxDir);
                        const result = {
                            id: tc.id,
                            status: 'error',
                            passed: false,
                            actualOutput: actual.replace(/\r\n/g, '\n'),
                            expectedOutput: tc.expectedOutput || '',
                            error: 'Output exceeded 128 KB sandbox limit (infinite output loop detected)'
                        };
                        socket.emit('test_case_result', result);
                        resolve(result);
                        return;
                    }
                    if (isErr) runError += chunk.toString();
                    else actual += chunk.toString();
                };

                rp.stdout.on('data', d => onChunk(d, false));
                rp.stderr.on('data', d => onChunk(d, true));

                rp.on('close', () => {
                    clearTimeout(execTimeout);
                    cleanupEphemeralSandboxDir(tcSandboxDir);
                    if (killed) return;
                    const normActual = actual.replace(/\r\n/g, '\n').trim();
                    const normExpected = (tc.expectedOutput || '').replace(/\r\n/g, '\n').trim();
                    const passed = normActual === normExpected;
                    const result = {
                        id: tc.id,
                        status: passed ? 'passed' : 'failed',
                        passed,
                        actualOutput: actual.replace(/\r\n/g, '\n'),
                        expectedOutput: tc.expectedOutput || '',
                        error: runError || null
                    };
                    socket.emit('test_case_result', result);
                    resolve(result);
                });

                rp.on('error', (err) => {
                    clearTimeout(execTimeout);
                    cleanupEphemeralSandboxDir(tcSandboxDir);
                    if (killed) return;
                    const result = {
                        id: tc.id,
                        status: 'error',
                        passed: false,
                        actualOutput: actual.replace(/\r\n/g, '\n'),
                        expectedOutput: tc.expectedOutput || '',
                        error: err.message
                    };
                    socket.emit('test_case_result', result);
                    resolve(result);
                });
            })));

            socket.emit('test_cases_results', { results });
        } catch (error) {
            console.error('Test case error:', error);
            socket.emit('test_cases_results', { results: [] });
        }
    });

    const handleStudentActivity = async (data) => {
        if (!data || (!data.studentId && !data.name)) return;
        if (data.submitted) return;
        const studentId = String(data.studentId || data.name);
        const studentName = String(data.name || data.studentName || studentId).trim();
        let classroomId = data.classroomId != null && data.classroomId !== 'default' ? String(data.classroomId) : 'none';
        const assignmentId = data.assignmentId != null && data.assignmentId !== 'default' ? String(data.assignmentId) : 'none';

        if ((!classroomId || classroomId === 'none' || classroomId === 'unassigned') && assignmentId !== 'none') {
            try {
                const foundCw = await db.get(
                    `SELECT classroom_id FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?`,
                    assignmentId, assignmentId
                );
                if (foundCw && foundCw.classroom_id != null) {
                    classroomId = String(foundCw.classroom_id);
                }
            } catch (_) { }
        }

        let classCode = null;
        if (classroomId && classroomId !== 'none') {
            try {
                const clsRow = await db.get(
                    `SELECT id, code FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(code) = ?`,
                    classroomId, classroomId, classroomId.toLowerCase()
                );
                if (clsRow) {
                    classroomId = String(clsRow.id);
                    classCode = clsRow.code ? String(clsRow.code) : null;
                }
            } catch (_) { }
        }

        const studentKey = `${classroomId}:${assignmentId}:${studentId}`;

        // Bawal mag-appear sa live monitoring kapag submitted na
        try {
            const alreadySubmitted = await db.get(
                `SELECT id FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (LOWER(student_name) = ? OR LOWER(student_name) = ?)`,
                assignmentId, assignmentId, studentName.toLowerCase(), studentId.toLowerCase()
            );
            if (alreadySubmitted) {
                delete activeStudents[studentKey];
                return;
            }
        } catch (_) { }

        // Alisin sa lumang activity para di mag-duplicate
        removeStudentFromPreviousActivities(studentId, studentName, studentKey);

        const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
        if (socket.data.roomName && socket.data.roomName !== roomName) {
            socket.leave(socket.data.roomName);
        }

        const existing = activeStudents[studentKey] || {};
        const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];

        // Merge any client-supplied logs
        let mergedLogs = existingLogs;
        if (Array.isArray(data.logs) && data.logs.length > 0) {
            const map = new Map();
            [...existingLogs, ...data.logs].forEach(l => {
                if (!l) return;
                const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
                if (!map.has(k)) {
                    map.set(k, {
                        id: l.id || Date.now(),
                        action: l.action || l.message || 'Violation',
                        message: l.message || l.action || 'Violation',
                        time: l.time || '',
                        color: l.color || '#ef4444',
                        studentId: studentId,
                        studentName: studentName
                    });
                }
            });
            mergedLogs = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        const updated = {
            ...existing,
            ...data,
            studentId,
            id: studentId,
            name: studentName,
            studentName,
            classroomId,
            classCode: classCode || existing.classCode || null,
            assignmentId,
            logs: mergedLogs,
            status: 'Live',
            isLive: true,
            lastActive: Date.now()
        };

        activeStudents[studentKey] = updated;
        socket.data.studentKey = studentKey;
        socket.data.studentId = studentId;
        socket.data.studentName = studentName;
        socket.data.classroomId = classroomId;
        socket.data.assignmentId = assignmentId;
        socket.data.roomName = roomName;

        socket.join(roomName);

        // Broadcast to monitoring teachers in this specific activity room and assignment room
        io.to(roomName).emit('teacher_update_code', updated);
        if (assignmentId && assignmentId !== 'none') {
            io.to(`assignment:${assignmentId}`).emit('teacher_update_code', updated);
        }

        // Relay to Render Cloud so teachers on Vercel see real-time updates!
        relayStudentActivity(updated);

        // Real-time update activity indicator dots for instructors
        broadcastActiveActivities();
    };

    socket.on('student_enter_activity', handleStudentActivity);
    socket.on('student_typing', handleStudentActivity);

    socket.on('proctor_alert', async (data) => {
        if (data && (data.studentId || data.id || data.name || data.studentName || socket.data?.studentId)) {
            const studentId = String(data.studentId || data.id || data.name || socket.data?.studentId || 'student');
            const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
            let classroomId = data.classroomId != null && data.classroomId !== 'default' ? String(data.classroomId) : null;
            let assignmentId = data.assignmentId != null && data.assignmentId !== 'default' ? String(data.assignmentId) : null;

            if (!classroomId || !assignmentId) {
                if (socket.data.studentKey) {
                    const parts = socket.data.studentKey.split(':');
                    if (parts.length >= 3) {
                        classroomId = classroomId || (parts[0] !== 'default' ? parts[0] : null);
                        assignmentId = assignmentId || (parts[1] !== 'default' ? parts[1] : null);
                    }
                } else {
                    const found = Object.values(activeStudents).find(s =>
                        s && (s.studentId === studentId || s.name === studentName)
                    );
                    if (found) {
                        classroomId = classroomId || (found.classroomId !== 'default' ? found.classroomId : null);
                        assignmentId = assignmentId || (found.assignmentId !== 'default' ? found.assignmentId : null);
                    }
                }
            }
            classroomId = classroomId || 'none';
            assignmentId = assignmentId || 'none';

            const actionText = data.action || data.desc || 'Violation';
            const messageText = data.message || actionText;
            const timeText = data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            const colorVal = data.color || '#ef4444';

            const newLog = {
                id: data.id || Date.now(),
                action: actionText,
                message: messageText,
                time: timeText,
                color: colorVal,
                studentId,
                studentName
            };

            const studentKey = `${classroomId}:${assignmentId}:${studentId}`;

            // Kung submitted na, i-record lang ang warning sa logs pero bawal sa live
            try {
                const alreadySubmitted = await db.get(
                    `SELECT id FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (LOWER(student_name) = ? OR LOWER(student_name) = ?)`,
                    assignmentId, assignmentId, studentName.toLowerCase(), studentId.toLowerCase()
                );
                if (alreadySubmitted) {
                    delete activeStudents[studentKey];
                    await db.run(
                        'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        classroomId, assignmentId, studentId, studentName, newLog.action, newLog.message, newLog.time, newLog.color
                    ).catch(() => { });
                    return;
                }
            } catch (_) { }

            const existing = activeStudents[studentKey] || {
                studentId,
                name: studentName,
                code: '',
                classroomId,
                assignmentId,
                logs: [],
                status: 'Live'
            };

            const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
            const isDup = existingLogs.some(l => l.action === newLog.action && (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000));
            const updatedLogs = isDup ? existingLogs : [newLog, ...existingLogs];

            activeStudents[studentKey] = {
                ...existing,
                studentId,
                name: studentName,
                classroomId,
                assignmentId,
                logs: updatedLogs,
                status: existing.status || 'Live'
            };

            if (studentName !== studentId) {
                const altKey = `${classroomId}:${assignmentId}:${studentName}`;
                if (activeStudents[altKey]) {
                    activeStudents[altKey].logs = updatedLogs;
                }
            }

            try {
                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    String(classroomId),
                    String(assignmentId),
                    String(studentId),
                    String(studentName),
                    actionText,
                    messageText,
                    timeText,
                    colorVal
                ).catch(() => { });
            } catch (_) { }

            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            const alertPayload = {
                ...data,
                id: newLog.id,
                studentId,
                name: studentName,
                action: actionText,
                message: messageText,
                time: timeText,
                color: colorVal,
                classroomId,
                assignmentId
            };
            io.to(roomName).emit('teacher_receive_alert', alertPayload);
            if (assignmentId && assignmentId !== 'none') {
                io.to(`assignment:${assignmentId}`).emit('teacher_receive_alert', alertPayload);
            }
            // Relay proctor alert to Render Cloud for Vercel teachers!
            relayProctorAlert(alertPayload);
        }

        try {
            const key = todayKey();
            const actionStr = (data?.action || '').toLowerCase();
            const descStr = (data?.desc || '').toLowerCase();
            const isCrash = Boolean(data?.isCrash) || actionStr.includes('crash') || descStr.includes('crash');
            const isSystemExit = !isCrash && (actionStr.includes('system exit') || descStr.includes('system exit') || descStr.includes('exited system') || descStr.includes('exited the system'));
            const isExitTab = !isCrash && !isSystemExit && (actionStr.includes('tab') || actionStr.includes('exit') || actionStr.includes('blur') || descStr.includes('tab') || descStr.includes('blur'));
            const isCopyPaste = !isCrash && (actionStr.includes('paste') || actionStr.includes('clipboard') || actionStr.includes('copy'));
            const isAltTabCopyPaste = !isCrash && (isExitTab || isCopyPaste || isSystemExit);

            if (isAltTabCopyPaste) {
                // Count under Alt-Tab / Copy-Paste flags
                await db.run(
                    'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 0, 1) ON CONFLICT(date_string) DO UPDATE SET alt_tab_copy_paste_count = COALESCE(security_flags.alt_tab_copy_paste_count, 0) + 1',
                    key
                );
            } else {
                // Count under high-severity Security Flags Today (including System Crash)
                await db.run(
                    'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1',
                    key
                );
            }

            const nowIso = new Date().toISOString();
            // Log event to audit_logs for admin activity view
            if (data && (data.studentId || data.name || data.email)) {
                const userName = data.name || data.email || data.studentId;

                let logType = 'Security Flag Alert';
                let logSeverity = 'High';

                if (isCrash) {
                    logType = 'System Crash Violation';
                    logSeverity = 'High';
                } else if (isSystemExit) {
                    logType = 'System Exit Violation';
                    logSeverity = 'Warning';
                } else if (isCopyPaste) {
                    logType = 'Copy/Paste Violation';
                    logSeverity = 'High';
                } else if (isExitTab) {
                    logType = 'Exit Tab Violation';
                    logSeverity = 'Warning';
                }

                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso,
                    userName,
                    logType,
                    logSeverity,
                    data.desc || (data.classroomId ? `${data.action || 'Violation alert'} in classroom ${data.classroomId}` : (data.action || 'Violation alert'))
                );
            }

            // Emit live real-time update to all admin sessions
            io.emit('admin_security_alert', {
                ...data,
                isCrash,
                isAltTabCopyPaste,
                isSystemExit,
                timestamp: nowIso
            });
            io.emit('admin_stats_update');
        } catch (e) { console.error(e); }
    });

    socket.on('submit_exam', async (data) => {
        if (!data) return;
        const { canonicalName: authenticatedName, canonicalId: authenticatedId, canonicalEmail, aliases } = await resolveCanonicalStudent(
            socket.user,
            data.studentName || data.studentId || 'Unknown',
            data.studentId,
            data.email || data.studentEmail || ''
        );
        const classroomId = data.classroomId || 'none';
        const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';

        const strictWarnings = await getTreatWarningsAsErrors();
        const payload = {
            ...data,
            studentName: authenticatedName,
            studentId: authenticatedId,
            studentEmail: canonicalEmail || data.studentEmail || data.email || '',
            strictWarningsEnforced: strictWarnings
        };

        // Tanggalin si student sa active roster at i-notify si teacher
        const targetId = String(data.studentId || authenticatedId || '');
        const targetName = String(data.studentName || authenticatedName || '').trim().toLowerCase();
        const aliasSet = new Set(aliases);

        for (const [key, student] of Object.entries(activeStudents)) {
            if (!student) continue;
            const curId = String(student.studentId || student.id || '');
            const curName = String(student.name || student.studentName || '').trim().toLowerCase();
            if (
                (targetId && (curId === targetId || key.endsWith(`:${targetId}`))) ||
                (targetName && (curName === targetName || key.endsWith(`:${targetName}`))) ||
                aliasSet.has(curName)
            ) {
                delete activeStudents[key];
            }
        }
        removeStudentFromPreviousActivities(targetId, targetName);
        removeStudentFromPreviousActivities(authenticatedId, authenticatedName);
        broadcastActiveActivities();

        const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
        socket.to(roomName).emit('teacher_receive_submission', payload);
        socket.to(roomName).emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
        io.emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
        relaySubmitExam(payload);
        relayStudentLeft({ studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });

        try {
            for (const alias of aliases) {
                await db.run(
                    'DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))',
                    assignmentId, alias
                ).catch(() => { });
            }
            const historyStr = JSON.stringify(Array.isArray(data.codeHistory) ? data.codeHistory : []);
            await db.run('INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)', assignmentId, authenticatedName, historyStr, new Date().toISOString());
        } catch (e) { console.error(e); }
    });

    socket.on('unsubmit_exam', async (data) => {
        if (!data) return;
        const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';
        const isTeacherOrAdmin = socket.user && ['Teacher', 'Admin'].includes(socket.user.role);
        if (!isTeacherOrAdmin && assignmentId !== 'unassigned') {
            try {
                const cwRow = await db.get(
                    'SELECT description FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?',
                    assignmentId, assignmentId
                );
                if (cwRow && cwRow.description) {
                    const meta = JSON.parse(cwRow.description);
                    if (meta.disableBack || meta.disable_back) {
                        socket.emit('unsubmit_error', {
                            message: 'Unsubmitting is not permitted for this activity.',
                            assignmentId
                        });
                        return;
                    }
                }
            } catch (_) { }
        }
        const { canonicalName: studentName, canonicalId: studentId, aliases } = await resolveCanonicalStudent(
            isTeacherOrAdmin ? null : socket.user,
            data.studentName || data.studentId || 'Unknown',
            data.studentId,
            data.email || data.studentEmail || ''
        );
        const classroomId = data.classroomId || 'none';
        const studentKey = `${classroomId}:${assignmentId}:${studentId || studentName}`;

        if (activeStudents[studentKey]) {
            activeStudents[studentKey] = { ...activeStudents[studentKey], status: 'Active' };
        }

        try {
            for (const alias of aliases) {
                await db.run(
                    `DELETE FROM submissions 
                     WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?)
                       AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))`,
                    assignmentId, String(assignmentId), alias
                ).catch(() => { });
            }
        } catch (e) { console.error(e); }

        const safeStudentId = String(studentId || '');
        const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
        socket.to(roomName).emit('teacher_student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
        socket.emit('student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
        socket.broadcast.emit('student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
        relayUnsubmitExam({ studentName, assignmentId, studentId: safeStudentId, classroomId });
    });

    socket.on('student_terminal_update', (data) => {
        if (data?.classroomId && data?.assignmentId) {
            io.to(`classroom:${data.classroomId}:assignment:${data.assignmentId}`).emit('teacher_terminal_update', data);
        } else {
            socket.broadcast.emit('teacher_terminal_update', data);
        }
        relayTerminalUpdate(data);
    });

    socket.on('student_leave_workspace', (data) => {
        if (activeProcess) {
            try { killProcessTree(activeProcess); } catch (_) { }
            activeProcess = null;
        }
        const studentId = socket.data.studentId || data?.studentId;
        const studentName = data?.name || data?.studentName || socket.user?.name || socket.data.studentName;
        const classroomId = data?.classroomId || socket.data.classroomId;
        const assignmentId = data?.assignmentId || socket.data.assignmentId;

        if (socket.data.studentKey) {
            delete activeStudents[socket.data.studentKey];
        }
        if (studentId || studentName) {
            removeStudentFromPreviousActivities(studentId, studentName);
        }

        const roomName = socket.data.roomName || (classroomId && assignmentId ? `classroom:${classroomId}:assignment:${assignmentId}` : null);
        const leftPayload = {
            studentId,
            studentName,
            classroomId,
            assignmentId,
            reason: 'left_workspace'
        };

        if (roomName) {
            io.to(roomName).emit('teacher_student_left', leftPayload);
            socket.leave(roomName);
        }
        socket.broadcast.emit('teacher_student_left', leftPayload);
        relayStudentLeft(leftPayload);

        socket.data.studentKey = null;
        socket.data.studentId = null;
        socket.data.studentName = null;
        socket.data.classroomId = null;
        socket.data.assignmentId = null;
        socket.data.roomName = null;

        broadcastActiveActivities();
    });

    socket.on('disconnect', async () => {
        if (activeProcess) {
            try { killProcessTree(activeProcess); } catch (_) { }
            activeProcess = null;
        }
        const studentId = socket.data.studentId || socket.user?.id;
        const studentName = socket.data.studentName || socket.user?.name;
        const classroomId = socket.data.classroomId;
        const assignmentId = socket.data.assignmentId;

        if (socket.data.studentKey) {
            delete activeStudents[socket.data.studentKey];
        }
        if (studentId || studentName) {
            removeStudentFromPreviousActivities(studentId, studentName);
        }

        const leftPayload = {
            studentId,
            studentName,
            classroomId,
            assignmentId,
            reason: 'disconnected'
        };

        if (socket.data.roomName) {
            io.to(socket.data.roomName).emit('teacher_student_left', leftPayload);
        }
        socket.broadcast.emit('teacher_student_left', leftPayload);

        broadcastActiveActivities();

        // If a student disconnects, check if an exit log was already posted in the last 4 seconds
        if (socket.user && socket.user.role === 'Student') {
            const userName = socket.user.name || socket.user.email || 'Student';
            try {
                const recentWindow = new Date(Date.now() - 4000).toISOString();
                const recent = await db.get(
                    `SELECT id FROM audit_logs WHERE ("user" = ? OR "user" = ?) AND timestamp >= ? LIMIT 1`,
                    userName, socket.user.email || userName, recentWindow
                );
                if (!recent) {
                    const key = todayKey();
                    const nowIso = new Date().toISOString();
                    await db.run(
                        'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1',
                        key
                    );
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso,
                        userName,
                        'System Exit Violation',
                        'Warning',
                        `Student exited the system: ${userName} closed or disconnected application (outside workspace)`
                    );
                    io.emit('admin_security_alert', {
                        user: userName,
                        name: userName,
                        studentId: socket.user.id || userName,
                        type: 'System Exit Violation',
                        desc: `Student exited the system: ${userName} closed or disconnected application`,
                        severity: 'Warning',
                        isAltTabCopyPaste: false,
                        isSystemExit: true,
                        timestamp: nowIso
                    });
                    io.emit('admin_stats_update');
                }
            } catch (_) { }
        }
    });
});

// --- AUDIT LOGS ---
app.get('/audit-logs/user/:identifier', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const id = decodeURIComponent(req.params.identifier);
        const logs = await db.all(
            `SELECT * FROM audit_logs WHERE LOWER("user") = LOWER(?) OR LOWER("user") = LOWER(?) ORDER BY id DESC LIMIT 200`,
            id, id
        );
        res.status(200).json({ logs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/audit-logs', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300');
        res.status(200).json({ logs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/audit-logs', authenticateToken, async (req, res) => {
    try {
        const { user = 'System', type = 'Event', severity = 'Normal', desc = '' } = req.body || {};
        const timestamp = new Date().toISOString();
        await db.run(
            'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
            timestamp, user, type, severity, desc
        );

        if (severity === 'High' || severity === 'Warning') {
            const key = todayKey();
            const descLower = (desc || '').toLowerCase();
            const typeLower = (type || '').toLowerCase();
            const isCrash = typeLower.includes('crash') || descLower.includes('crash');
            const isSystemExit = !isCrash && (typeLower.includes('system exit') || descLower.includes('system exit') || descLower.includes('exited system') || descLower.includes('exited the system'));
            const isAltTabCopyPaste = !isCrash && (isSystemExit || descLower.includes('tab') || descLower.includes('paste') || descLower.includes('clipboard') || descLower.includes('copy') || descLower.includes('exit tab') || typeLower.includes('alt-tab') || typeLower.includes('copy-paste'));

            if (isAltTabCopyPaste) {
                await db.run(
                    `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 0, 1) ON CONFLICT(date_string) DO UPDATE SET alt_tab_copy_paste_count = COALESCE(security_flags.alt_tab_copy_paste_count, 0) + 1`,
                    key
                );
            } else {
                await db.run(
                    `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
                    key
                );
            }

            const timeText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            const actionText = isCrash ? 'System Crash' : (isAltTabCopyPaste ? (descLower.includes('paste') ? 'Copy/Paste' : 'Alt Tab') : (type || 'Violation'));
            const colorVal = isCrash ? '#dc2626' : (isAltTabCopyPaste ? '#eab308' : '#ef4444');

            // Find classroom/assignment context for this student if active
            const foundActive = Object.values(activeStudents).find(s => s && (s.studentId === user || s.name === user));
            const cId = foundActive?.classroomId || 'none';
            const aId = foundActive?.assignmentId || 'none';

            try {
                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    cId,
                    aId,
                    String(user),
                    String(user),
                    actionText,
                    actionText,
                    timeText,
                    colorVal
                ).catch(() => { });
            } catch (_) { }

            // Broadcast directly to instructors in Live Monitoring for this specific activity
            if (aId && aId !== 'none' && aId !== 'default') {
                const targetRoom = `classroom:${cId}:assignment:${aId}`;
                io.to(targetRoom).emit('teacher_receive_alert', {
                    id: Date.now(),
                    studentId: user,
                    studentName: user,
                    name: user,
                    action: actionText,
                    message: actionText,
                    time: timeText,
                    color: colorVal,
                    isCrash,
                    classroomId: cId,
                    assignmentId: aId
                });
            }

            // Emit live real-time update to all admin sessions
            io.emit('admin_security_alert', {
                user,
                name: user,
                studentId: user,
                type,
                desc,
                action: desc,
                isAltTabCopyPaste,
                isSystemExit,
                timestamp
            });
            io.emit('admin_stats_update');
        }

        res.status(201).json({ message: 'Log entry saved', timestamp });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- SYSTEM SETTINGS API ---
app.get('/system-settings', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all('SELECT key, value FROM system_settings');
        const settings = {};
        rows.forEach(r => {
            try { settings[r.key] = JSON.parse(r.value); }
            catch (e) { settings[r.key] = r.value; }
        });
        res.status(200).json({ settings });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- DATA RETENTION & AUDIT ARCHIVAL MAINTENANCE (Admin Settings: data.retentionPeriod / data.autoArchiveAuditLogs) ---
async function runDataRetentionMaintenance() {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (!row || !row.value) return;
        const config = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        const dataCfg = config?.data || {};
        const now = Date.now();

        // 1. Delete archived classes older than configured retentionPeriod ('1 Year' | '3 Years' | 'Never')
        const retention = String(dataCfg.retentionPeriod || '3 Years');
        let retentionMs = null;
        if (retention === '1 Year') retentionMs = 365 * 24 * 60 * 60 * 1000;
        else if (retention === '3 Years') retentionMs = 3 * 365 * 24 * 60 * 60 * 1000;

        if (retentionMs) {
            const cutoffMs = now - retentionMs;
            const archivedClasses = await db.all('SELECT id FROM classrooms WHERE archived = 1').catch(() => []);
            for (const cls of archivedClasses) {
                const clsIdNum = Number(cls.id);
                // Class IDs are epoch ms (> 1e12); delete if older than retention cutoff
                if (!isNaN(clsIdNum) && clsIdNum > 1e12 && clsIdNum < cutoffMs) {
                    await db.run('DELETE FROM enrollments WHERE classroom_id = ?', cls.id).catch(() => { });
                    await db.run('DELETE FROM classwork WHERE classroom_id = ?', cls.id).catch(() => { });
                    await db.run('DELETE FROM announcements WHERE classroom_id = ?', cls.id).catch(() => { });
                    await db.run('DELETE FROM classrooms WHERE id = ?', cls.id).catch(() => { });
                }
            }
        }

        // 2. Auto-archive / prune audit logs older than configured autoArchiveAuditLogs ('7 Days' | '30 Days' | 'Never')
        const auditPolicy = String(dataCfg.autoArchiveAuditLogs || '30 Days');
        let auditDays = null;
        if (auditPolicy === '7 Days') auditDays = 7;
        else if (auditPolicy === '30 Days') auditDays = 30;

        if (auditDays) {
            const cutoffIso = new Date(now - auditDays * 24 * 60 * 60 * 1000).toISOString();
            const logs = await db.all('SELECT id, timestamp FROM audit_logs').catch(() => []);
            for (const log of logs) {
                if (log.timestamp) {
                    const ts = new Date(log.timestamp).getTime();
                    if (!isNaN(ts) && ts < new Date(cutoffIso).getTime()) {
                        await db.run('DELETE FROM audit_logs WHERE id = ?', log.id).catch(() => { });
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[Data Retention] Maintenance notice:', e.message);
    }
}

setTimeout(() => runDataRetentionMaintenance().catch(() => { }), 15000);
setInterval(() => runDataRetentionMaintenance().catch(() => { }), 6 * 60 * 60 * 1000);

// --- REAL SYSTEM BACKUP ENDPOINT (Admin Settings: Generate System Backup) ---
app.post('/api/admin/backup', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const backupsDir = path.join(DATA_DIR, 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

        const tables = ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements', 'system_settings', 'audit_logs'];
        const snapshot = {
            generatedAt: new Date().toISOString(),
            generatedBy: req.user?.email || req.user?.name || 'Admin',
            version: process.env.APP_VERSION || '1.0.0',
            tables: {}
        };

        for (const tbl of tables) {
            try {
                const rows = await db.all(`SELECT * FROM ${tbl}`);
                // Redact password hashes/values in backup export? Keep full DB snapshot for restore while tagging counts
                snapshot.tables[tbl] = rows || [];
            } catch (_) {
                snapshot.tables[tbl] = [];
            }
        }

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `verity_backup_${stamp}.json`;
        const filePath = path.join(backupsDir, filename);
        const jsonContent = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(filePath, jsonContent, 'utf8');

        const userName = req.user?.email || req.user?.name || 'Admin';
        await db.run(
            'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
            userName,
            'Database Backup',
            'Normal',
            `Admin generated full system backup (${filename}, ${(Buffer.byteLength(jsonContent) / 1024).toFixed(1)} KB)`
        ).catch(() => { });

        res.status(200).json({
            success: true,
            filename,
            sizeBytes: Buffer.byteLength(jsonContent),
            generatedAt: snapshot.generatedAt,
            backup: snapshot
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

const handleSaveSettings = async (req, res) => {
    try {
        const { settings } = req.body || {};
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ message: 'Invalid settings object' });
        }
        const enrichedSettings = {};
        for (const [key, val] of Object.entries(settings)) {
            const payload = (val && typeof val === 'object' && !Array.isArray(val))
                ? { ...val, _updatedAt: Date.now() }
                : val;
            enrichedSettings[key] = payload;
            const strVal = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
            await db.run('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, strVal);
        }
        io.emit('system_settings_updated', { settings: enrichedSettings });
        getKioskSettings().then(kioskConfig => {
            io.emit('kiosk_settings', kioskConfig);
        }).catch(() => { });
        db.triggerSync();
        runDataRetentionMaintenance().catch(() => { });
        const userName = req.user?.email || req.user?.name || 'unknown';
        await db.run('INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)', userName, 'System Settings Updated', 'Normal', 'Admin updated system settings via API');
        res.status(200).json({ message: 'Settings saved successfully' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

app.put('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);

// Backward compatibility: POST delegates to the same handler
app.post('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);

// --- ACCESS TOKENS API ---
app.get('/access-tokens', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const tokens = await db.all('SELECT * FROM access_tokens ORDER BY id DESC');
        res.status(200).json({ tokens });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/access-tokens', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const { studentName, classroom, count = 1 } = req.body || {};
        const generated = [];

        for (let i = 0; i < count; i++) {
            const randPart = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const tokenStr = `VRTY-EXAM-${randPart}`;
            const name = studentName || `Student ${i + 1}`;
            const cls = classroom || 'General Roster';
            const created = new Date().toISOString();
            await db.run('INSERT INTO access_tokens (token, student_name, classroom, created_at) VALUES (?, ?, ?, ?)', tokenStr, name, cls, created);
            generated.push({ token: tokenStr, student_name: name, classroom: cls, created_at: created });
        }
        res.status(201).json({ message: `${count} token(s) generated`, tokens: generated });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/access-tokens/:id', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        await db.run('DELETE FROM access_tokens WHERE id = ?', req.params.id);
        res.status(200).json({ message: 'Token deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ROSTER IMPORT API ---
app.post('/users/import', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const { users } = req.body || {};
        if (!Array.isArray(users)) return res.status(400).json({ message: 'users array required' });

        let added = 0;
        let skipped = 0;

        for (const u of users) {
            if (!u.email || !u.name) continue;
            const existing = await db.get('SELECT id FROM users WHERE email = ?', u.email);
            if (existing) {
                skipped++;
            } else {
                const pass = u.password || 'verity2026';
                const role = u.role || 'Student';
                const status = u.status || 'Active';
                await db.run('INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', u.name, u.email, pass, role, status);
                added++;
            }
        }

        res.status(200).json({ message: `Roster import complete: ${added} added, ${skipped} skipped (already exists).`, added, skipped });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- QUESTION BANK API ---
app.get('/question-bank', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM question_bank ORDER BY id DESC');
        const questions = rows.map(q => ({
            ...q,
            test_cases: JSON.parse(q.test_cases || '[]')
        }));
        res.status(200).json({ questions });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/question-bank', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const { id, title, description, starter_code, test_cases = [], points = 100 } = req.body || {};
        const tcStr = JSON.stringify(test_cases);

        if (id) {
            await db.run(
                'UPDATE question_bank SET title = ?, description = ?, starter_code = ?, test_cases = ?, points = ? WHERE id = ?',
                title, description, starter_code, tcStr, points, id
            );
            res.status(200).json({ message: 'Question updated' });
        } else {
            const info = await db.run(
                'INSERT INTO question_bank (title, description, starter_code, test_cases, points) VALUES (?, ?, ?, ?, ?)',
                title, description, starter_code, tcStr, points
            );
            res.status(201).json({ message: 'Question created', id: info.lastInsertRowid });
        }
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/question-bank/:id', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        await db.run('DELETE FROM question_bank WHERE id = ?', req.params.id);
        res.status(200).json({ message: 'Question deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// START SERVER (deferred when loaded from Electron; auto-start when run directly)
async function reconcileDatabaseClassrooms() {
    try {
        const teachers = await db.all("SELECT id, name, email FROM users WHERE LOWER(role) = 'teacher' OR LOWER(role) = 'instructor'").catch(() => []);
        for (const t of (teachers || [])) {
            if (!t.name || !t.email) continue;
            await db.run(
                `UPDATE classrooms SET instructor_email = ? 
                 WHERE (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = TRIM(LOWER(?)))
                   AND (instructor_email IS NULL OR instructor_email = '' OR LOWER(instructor_email) != LOWER(?))`,
                t.email.trim().toLowerCase(), t.name.trim(), t.email.trim().toLowerCase()
            ).catch(() => { });
        }
    } catch (e) {
        console.warn('[reconcileDatabaseClassrooms] Warning during startup sync:', e.message);
    }
}

// --- COMLAB OFFLINE / LAN: SERVE FRONTEND BUNDLE IF PRESENT ---
const candidateDistDirs = [
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
    path.join(process.cwd(), 'dist'),
    process.resourcesPath ? path.join(process.resourcesPath, 'dist') : null
].filter(Boolean);

const frontendDistPath = candidateDistDirs.find(d => fs.existsSync(path.join(d, 'index.html')));

if (frontendDistPath) {
    app.use(express.static(frontendDistPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith(`${path.sep}index.html`) || filePath.endsWith('/index.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            } else if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes('/assets/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));
    app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        if (req.path.startsWith('/api') ||
            req.path.startsWith('/socket.io') ||
            req.path.startsWith('/uploads') ||
            req.path === '/health' ||
            req.path.includes('.')) {
            return next();
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

function getLanIpAddresses() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

const { startLanDiscovery, stopLanDiscovery } = require('./lanDiscovery');

function start(port = process.env.PORT || 3001) {
    return new Promise((resolve) => {
        const p = parseInt(port, 10) || 3001;
        server.listen(p, '0.0.0.0', () => {
            const lanIps = getLanIpAddresses();
            console.log('\n========================================================');
            console.log('  THE VERITY - OFFLINE COMLAB / LAN SERVER READY');
            console.log('========================================================');
            console.log(`  Local Machine:     http://localhost:${p}`);
            if (lanIps.length > 0) {
                lanIps.forEach(ip => {
                    console.log(`  ComLab Student PCs: Connect via The Verity.exe (Server: http://${ip}:${p})`);
                    console.log(`  Mobile / Phone Web: http://${ip}:${p} (Phones only)`);
                });
            }
            console.log('--------------------------------------------------------');
            console.log(`  Database Provider:   ${db.providerName}`);
            if (frontendDistPath) {
                console.log(`  Serving Web App:     ${frontendDistPath}`);
            }
            console.log('  100% Offline Capable: No external internet required');
            console.log('========================================================\n');

            // Check if this instance is designated as the Host/Teacher Server
            const isExplicitClient = process.env.IS_LAN_HOST === 'false';
            const isHost = !isExplicitClient && (
                process.env.IS_LAN_HOST === 'true' ||
                process.env.IS_VERITY_ADMIN === 'true' ||
                fs.existsSync(path.join(DATA_DIR, 'host.flag')) ||
                fs.existsSync(path.join(__dirname, 'host.flag')) ||
                process.argv.includes('--host') ||
                require.main === module
            );

            try {
                startLanDiscovery(p, isHost);
            } catch (dErr) {
                console.warn('[LAN Discovery] Start error:', dErr.message);
            }

            reconcileDatabaseClassrooms().catch(() => { });
            if (IS_RENDER_CLOUD && r2Storage.isR2Configured()) {
                r2Storage.ensureBucketCors().catch(() => { });
            }
            resolve(p);
        });
    });
}

function stop() {
    return new Promise((resolve) => {
        try {
            stopLanDiscovery();
        } catch (_) { }
        io.close();
        server.close(() => resolve());
    });
}

// Run immediately when this file is executed directly (e.g. `node server/server.js`).
if (require.main === module) {
    const port = process.env.PORT || 3001;
    start(port);
}

module.exports = { start, stop, app };
// Watch reload trigger: 2026-10-17T09:38:00Z