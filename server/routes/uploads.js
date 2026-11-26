const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

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

/**
 * Registers /uploads serving, R2/Postgres hydration, FFmpeg video transcoding,
 * raw binary streaming uploads, and base64 uploads.
 */
function registerUploadRoutes(app, { db, DATA_DIR, IS_RENDER_CLOUD, r2Storage, authenticateToken, checkIsHost }) {
    const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const CLOUD_MEDIA_BASE_URL = (
        process.env.CLOUD_API_URL ||
        process.env.CLOUD_SOCKET_URL ||
        'https://verity-2z4v.onrender.com'
    ).trim().replace(/\/$/, '');

    try {
        for (const entry of fs.readdirSync(UPLOADS_DIR)) {
            if (entry.endsWith('.part') || entry.endsWith('_faststart.mp4') || entry.endsWith('_opt.mp4')) {
                try { fs.unlinkSync(path.join(UPLOADS_DIR, entry)); } catch (_) { }
            }
        }
    } catch (_) { }

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

    const activeUploadStreams = new Map();
    const pendingVideoSwaps = new Map();
    const inFlightCloudPulls = new Map();

    function tryApplyPendingSwap(filename) {
        const tempPath = pendingVideoSwaps.get(filename);
        if (!tempPath || (activeUploadStreams.get(filename) || 0) > 0) return;
        const targetPath = path.join(UPLOADS_DIR, filename);
        try {
            if (fs.existsSync(tempPath)) fs.renameSync(tempPath, targetPath);
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

    async function pullUploadFromCloud(filename) {
        if (IS_RENDER_CLOUD || !isSafeUploadBasename(filename)) return false;
        const targetPath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(targetPath)) return true;
        if (inFlightCloudPulls.has(filename)) return inFlightCloudPulls.get(filename);

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

    function prefetchUploadsFromClasswork(rows) {
        if (IS_RENDER_CLOUD || !checkIsHost() || !Array.isArray(rows)) return;
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

    app.use('/uploads', async (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Accept-Ranges', 'bytes');
        if (path.extname(req.path || '').toLowerCase() === '.svg') {
            res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        }
        if (req.method === 'OPTIONS') return res.status(204).end();

        let requestedName = '';
        try {
            requestedName = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
        } catch (_) {
            return res.status(400).end();
        }
        if (!isSafeUploadBasename(requestedName)) return res.status(404).end();

        const isDownloadReq = Boolean(req.query && (req.query.download === '1' || req.query.download === 'true'));
        const rawDownloadName = isDownloadReq
            ? ((typeof req.query.filename === 'string' && req.query.filename.trim())
                ? req.query.filename.trim()
                : requestedName.replace(/^\d+_/, ''))
            : '';

        const localTarget = path.join(UPLOADS_DIR, requestedName);

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
                    method: req.method, expiresIn: 3600, downloadFilename: rawDownloadName
                });
                if (direct && direct.url) {
                    res.setHeader('Cache-Control', direct.isPublic ? 'public, max-age=86400' : 'private, max-age=1800');
                    return res.redirect(302, direct.url);
                }
            }
        }

        if ((req.method === 'GET' || req.method === 'HEAD') && !fs.existsSync(localTarget)) {
            let hydrated = false;
            if (r2Storage.isR2Configured()) {
                hydrated = await r2Storage.downloadFileFromR2(requestedName, localTarget).catch(() => false);
            }
            if (!hydrated) {
                hydrated = await db.restoreUploadFromCloudDb(requestedName, localTarget).catch(() => false);
                if (hydrated && r2Storage.isR2Configured()) {
                    const ext = path.extname(requestedName).toLowerCase();
                    const mime = UPLOAD_MIME_TYPES[ext] || 'application/octet-stream';
                    r2Storage.uploadFileToR2(requestedName, localTarget, mime).catch(() => { });
                }
            }
            if (!hydrated && !IS_RENDER_CLOUD) {
                try {
                    const cloudHost = new URL(CLOUD_MEDIA_BASE_URL).host;
                    if (req.get('host') !== cloudHost) await pullUploadFromCloud(requestedName);
                } catch (_) { }
            }
        }

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
            if (mime) res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', VIDEO_UPLOAD_EXTS.has(ext) ? 'public, max-age=3600' : 'public, max-age=86400');
        }
    }));

    let ffmpegStaticPath = null;
    try { ffmpegStaticPath = require('ffmpeg-static'); } catch (_) { }
    if (!ffmpegStaticPath || typeof ffmpegStaticPath !== 'string') {
        try {
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
                    try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) { }
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
        if (!videoProcessingQueue.includes(targetPath)) videoProcessingQueue.push(targetPath);
        drainVideoProcessingQueue().catch((err) => {
            console.warn('[Video Queue] Error:', err?.message || err);
        });
    }

    async function processVideoJob(targetPath) {
        if (!ffmpegStaticPath || !fs.existsSync(targetPath)) return;
        const ext = path.extname(targetPath).toLowerCase();
        if (!VIDEO_UPLOAD_EXTS.has(ext)) return;

        const baseNoExt = targetPath.slice(0, -ext.length);
        const thumbPath = `${baseNoExt}_thumb.jpg`;
        const faststartTempPath = `${baseNoExt}_faststart.mp4`;
        const tempOptPath = `${baseNoExt}_opt.mp4`;

        const thumbCode = await runFfmpegAsync([
            '-y', '-ss', '00:00:03', '-i', targetPath, '-vframes', '1',
            '-vf', "scale='min(640,iw)':-2", '-q:v', '3', thumbPath
        ], 'Video Thumb');
        if (thumbCode !== 0 || !fs.existsSync(thumbPath)) {
            await runFfmpegAsync([
                '-y', '-ss', '00:00:00', '-i', targetPath, '-vframes', '1',
                '-vf', "scale='min(640,iw)':-2", '-q:v', '3', thumbPath
            ], 'Video Thumb Fallback');
        }
        if (fs.existsSync(thumbPath)) {
            persistUploadedFile(path.basename(thumbPath), thumbPath, '.jpg').catch(() => { });
        }

        try {
            const stats = fs.statSync(targetPath);
            if (stats.size <= 15 * 1024 * 1024) return;

            if (FASTSTART_REMUX_EXTS.has(ext)) {
                const remuxCode = await runFfmpegAsync([
                    '-y', '-i', targetPath, '-c', 'copy', '-movflags', '+faststart', faststartTempPath
                ], 'Video Faststart');
                if (remuxCode === 0 && fs.existsSync(faststartTempPath) && fs.statSync(faststartTempPath).size > 0) {
                    safeReplaceOrDeferSwap(targetPath, faststartTempPath);
                } else {
                    try { if (fs.existsSync(faststartTempPath)) fs.unlinkSync(faststartTempPath); } catch (_) { }
                }
            }

            const nvencCode = await runFfmpegAsync([
                '-y', '-i', targetPath, '-vf', "scale='min(1280,iw)':-2",
                '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '28', '-b:v', '350k',
                '-maxrate', '500k', '-bufsize', '800k', '-c:a', 'aac', '-b:a', '64k',
                '-movflags', '+faststart', tempOptPath
            ], 'Video Compression NVENC');

            let compressedOk = nvencCode === 0 && fs.existsSync(tempOptPath);
            if (!compressedOk) {
                try { if (fs.existsSync(tempOptPath)) fs.unlinkSync(tempOptPath); } catch (_) { }
                const cpuThreads = String(Math.max(1, Math.min(4, Math.floor((os.cpus()?.length || 2) / 2))));
                const cpuCode = await runFfmpegAsync([
                    '-y', '-i', targetPath, '-vf', "scale='min(1280,iw)':-2",
                    '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast',
                    '-threads', cpuThreads, '-c:a', 'aac', '-b:a', '64k',
                    '-movflags', '+faststart', tempOptPath
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

    app.post('/upload-raw', authenticateToken, (req, res) => {
        req.setTimeout(0);
        res.setTimeout(0);

        const rawFilename = req.query.filename || req.headers['x-filename'] || 'file.mp4';
        const ext = path.extname(rawFilename).toLowerCase();
        if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
            return res.status(400).json({ message: `File type "${ext || 'unknown'}" is not allowed. ${SUPPORTED_UPLOAD_MESSAGE}` });
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
            if (!res.headersSent) res.status(499).json({ message: 'Upload aborted' });
        });

        req.pipe(writeStream);

        writeStream.on('finish', async () => {
            if (finished) return;
            finished = true;
            processVideoUpload(targetPath);
            try {
                const stat = fs.statSync(targetPath);
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
            if (!res.headersSent) res.status(500).json({ message: 'Failed to write upload stream' });
        });
    });

    app.post('/upload', authenticateToken, (req, res) => {
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
            return res.status(400).json({ message: `File type "${ext || 'unknown'}" is not allowed. ${SUPPORTED_UPLOAD_MESSAGE}` });
        }

        const buffer = Buffer.from(match[2], 'base64');
        const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const unique = `${Date.now()}_${safeName}`;
        const targetPath = path.join(UPLOADS_DIR, unique);
        fs.writeFileSync(targetPath, buffer);
        processVideoUpload(targetPath);
        persistUploadedFile(unique, targetPath, ext)
            .catch(() => { })
            .finally(() => res.status(201).json(buildUploadResponse(req, unique, ext)));
    });

    return { prefetchUploadsFromClasswork };
}

module.exports = { registerUploadRoutes };
