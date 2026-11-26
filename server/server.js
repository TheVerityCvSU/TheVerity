const dns = require('dns');
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (_) { }

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const envCandidates = [
    process.env.ENV_FILE_PATH,
    path.join(__dirname, '..', 'server', '.env'),
    path.join(__dirname, 'server', '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
    path.join(process.cwd(), 'server', '.env'),
    path.join(process.cwd(), '.env')
].filter(Boolean);

if (process.env.VERITY_SKIP_DOTENV !== '1') {
    for (const p of envCandidates) {
        if (fs.existsSync(p)) {
            try { require('dotenv').config({ path: p, override: true }); } catch (_) { }
        }
    }
}

const db = require('./db/index.js');
const dotnetManager = require('./dotnetManager');
const r2Storage = require('./r2Storage');
const { startLanDiscovery, stopLanDiscovery } = require('./lanDiscovery');
const { shutdownCloudRelay } = require('./cloudRelay');
const { resolveJwtSecret, isAllowedCorsOrigin, isHostServerInstance } = require('./utils/serverHelpers');
const { createAuthMiddleware } = require('./middleware/authMiddleware');
const { createSystemSettingsService } = require('./services/systemSettingsService');
const { createCompilerService } = require('./services/compilerService');
const { createClassroomHelpers } = require('./services/classroomAccess');
const { createActiveStudentsService } = require('./services/activeStudentsService');
const { createStudentNotificationService } = require('./services/studentNotificationService');

const { registerUploadRoutes } = require('./routes/uploads');
const { registerSystemRoutes } = require('./routes/system');
const { registerAuthRoutes } = require('./routes/auth');
const { registerUserRoutes } = require('./routes/users');
const { registerClassworkRoutes } = require('./routes/classwork');
const { registerClassroomRoutes } = require('./routes/classrooms');
const { registerSubmissionRoutes } = require('./routes/submissions');
const { registerAdminRoutes } = require('./routes/admin');
const { registerSocketHandlers } = require('./sockets/registerSocketHandlers');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const IS_RENDER_CLOUD = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.IS_RENDER_SERVICE);
const { secret: JWT_SECRET, isShared: HAS_SHARED_JWT_SECRET } = resolveJwtSecret(DATA_DIR);

if (!HAS_SHARED_JWT_SECRET && IS_RENDER_CLOUD) {
    console.error('[SECURITY WARNING] JWT_SECRET environment variable is missing on Cloud server! Set JWT_SECRET in Render Environment Variables.');
} else if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'verity_super_secret_key') {
    console.warn('[SECURITY WARNING] JWT_SECRET is using the insecure default key in production! Set JWT_SECRET in your environment.');
}

const EXTRA_ALLOWED_ORIGINS = new Set(
    String(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
        .split(',')
        .map(s => s.trim().replace(/\/$/, ''))
        .filter(Boolean)
);

const app = express();
app.set('trust proxy', (IS_RENDER_CLOUD || process.env.TRUST_PROXY === 'true') ? 1 : false);
app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin, EXTRA_ALLOWED_ORIGINS)),
    credentials: true
}));
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
});

const server = http.createServer(app);
server.requestTimeout = 0;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin, EXTRA_ALLOWED_ORIGINS)),
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const checkIsHost = () => isHostServerInstance({ dataDir: DATA_DIR, serverDir: __dirname, isMainModule: require.main === module });
const authMiddleware = createAuthMiddleware({ JWT_SECRET, IS_RENDER_CLOUD });
const activeStudentsService = createActiveStudentsService({ io });
const settingsService = createSystemSettingsService({ db, io, activeStudents: activeStudentsService.activeStudents });
const compilerService = createCompilerService();
const studentNotificationService = createStudentNotificationService({ db });
const classroomHelpers = createClassroomHelpers({
    db,
    io,
    onClassworkCreated: (classroomId, newItems) => studentNotificationService.notifyNewClassworkItems(classroomId, newItems)
});

const { prefetchUploadsFromClasswork } = registerUploadRoutes(app, {
    db, DATA_DIR, IS_RENDER_CLOUD, r2Storage,
    authenticateToken: authMiddleware.authenticateToken,
    checkIsHost
});

try {
    const { setSocketIo, setOnClassworkPulled } = require('./db/cloudSync');
    setSocketIo(io);
    setOnClassworkPulled(prefetchUploadsFromClasswork);
} catch (_) { }

registerSystemRoutes(app, {
    db, io, serverDir: __dirname, dotnetManager,
    authMiddleware, settingsService, compilerService, activeStudentsService, checkIsHost
});
registerAuthRoutes(app, { db, io, JWT_SECRET, authMiddleware, settingsService });
registerUserRoutes(app, { db, io, JWT_SECRET, authMiddleware, settingsService, classroomHelpers, studentNotificationService });
registerClassworkRoutes(app, { db, io, authMiddleware, classroomHelpers });
registerClassroomRoutes(app, { db, io, authMiddleware, classroomHelpers });
registerSubmissionRoutes(app, { db, io, IS_RENDER_CLOUD, authMiddleware, classroomHelpers });
registerAdminRoutes(app, { db, io, DATA_DIR, authMiddleware, settingsService, activeStudentsService });
registerSocketHandlers(io, {
    db, IS_RENDER_CLOUD, dotnetManager, authMiddleware, settingsService, compilerService, classroomHelpers, activeStudentsService
});

// Background maintenance loops (.unref() so tests exit cleanly when importing app)
compilerService.ensureBaseTemplate().catch(err => console.warn('Non-blocking compiler warmup notice:', err.message));
const tempCleanupInterval = setInterval(() => {
    try {
        const tmpDir = os.tmpdir();
        const now = Date.now();
        const MAX_AGE_MS = 12 * 60 * 60 * 1000;
        for (const file of fs.readdirSync(tmpDir)) {
            if (file.startsWith('verity_ws_') || file.startsWith('verity_temp_')) {
                const fullPath = path.join(tmpDir, file);
                try {
                    if (now - fs.statSync(fullPath).mtimeMs > MAX_AGE_MS) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                } catch (_) { }
            }
        }
    } catch (_) { }
}, 60 * 60 * 1000);
tempCleanupInterval.unref();

const initialRetentionTimer = setTimeout(() => settingsService.runDataRetentionMaintenance().catch(() => { }), 15000);
initialRetentionTimer.unref();
const retentionInterval = setInterval(() => settingsService.runDataRetentionMaintenance().catch(() => { }), 6 * 60 * 60 * 1000);
retentionInterval.unref();

// ComLab Offline / LAN: Serve built frontend bundle if present
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
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads') || req.path === '/health' || req.path.includes('.')) {
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
            if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
        }
    }
    return ips;
}

function start(port = process.env.PORT ?? 3001) {
    return new Promise((resolve) => {
        const parsed = Number.parseInt(port, 10);
        const targetPort = Number.isNaN(parsed) ? 3001 : parsed;
        server.listen(targetPort, '0.0.0.0', () => {
            const p = server.address()?.port ?? targetPort;
            const lanIps = getLanIpAddresses();
            console.log('\n========================================================');
            console.log('  THE VERITY - OFFLINE COMLAB / LAN SERVER READY');
            console.log('========================================================');
            console.log(`  Local Machine:     http://localhost:${p}`);
            lanIps.forEach(ip => {
                console.log(`  ComLab Student PCs: Connect via The Verity.exe (Server: http://${ip}:${p})`);
                console.log(`  Mobile / Phone Web: http://${ip}:${p} (Phones only)`);
            });
            console.log('--------------------------------------------------------');
            console.log(`  Database Provider:   ${db.providerName}`);
            if (frontendDistPath) console.log(`  Serving Web App:     ${frontendDistPath}`);
            console.log('  100% Offline Capable: No external internet required');
            console.log('========================================================\n');

            try {
                startLanDiscovery(p, checkIsHost());
            } catch (dErr) {
                console.warn('[LAN Discovery] Start error:', dErr.message);
            }

            classroomHelpers.reconcileDatabaseClassrooms().catch(() => { });
            studentNotificationService.startScheduler();
            if (IS_RENDER_CLOUD && r2Storage.isR2Configured()) {
                r2Storage.ensureBucketCors().catch(() => { });
            }
            resolve(p);
        });
    });
}

function stop() {
    return new Promise((resolve) => {
        try { studentNotificationService.stopScheduler(); } catch (_) { }
        try { stopLanDiscovery(); } catch (_) { }
        try { shutdownCloudRelay(); } catch (_) { }
        io.close();
        server.close(() => resolve());
    });
}

if (require.main === module) {
    start(process.env.PORT || 3001);
}

module.exports = { start, stop, app, studentNotificationService };
