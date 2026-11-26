const fs = require('fs');
const path = require('path');
const os = require('os');
const { getValidLanIps } = require('../utils/serverHelpers');

function compareSemver(latest, current) {
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
}

function findLocalInstallers(dirs, isAdmin) {
    const found = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            for (const f of fs.readdirSync(dir)) {
                const lower = f.toLowerCase();
                if (lower.endsWith('.exe') && lower.includes('verity') && (isAdmin ? lower.includes('admin') : !lower.includes('admin'))) {
                    const vMatch = f.match(/(\d+\.\d+\.\d+)/);
                    found.push({
                        path: path.join(dir, f),
                        filename: f,
                        version: vMatch ? vMatch[1] : '0.0.0',
                        isSetup: lower.includes('setup')
                    });
                }
            }
        } catch (_) { }
    }
    found.sort((a, b) => {
        if (compareSemver(a.version, b.version)) return -1;
        if (compareSemver(b.version, a.version)) return 1;
        if (a.isSetup && !b.isSetup) return -1;
        if (!a.isSetup && b.isSetup) return 1;
        return 0;
    });
    return found;
}

/**
 * Registers health checks, update distribution, cloud/LAN sync triggers,
 * .NET bootstrap endpoints, maintenance/kiosk config, and active activity badges.
 */
function registerSystemRoutes(app, {
    db,
    io,
    serverDir,
    dotnetManager,
    authMiddleware,
    settingsService,
    compilerService,
    activeStudentsService,
    checkIsHost
}) {
    const { authenticateTokenOrLoopback, isLoopbackAddress } = authMiddleware;
    const { getMaintenanceStatus, getKioskSettings } = settingsService;
    const { OFFLINE_DOTNET_ENV, resetDotnetCache, ensureBaseTemplate } = compilerService;
    const { getActiveActivitiesMap, getActiveClassroomsMap } = activeStudentsService;

    app.get('/robots.txt', (req, res) => {
        res.type('text/plain');
        res.send('User-agent: *\nDisallow: /\n');
    });

    app.get('/api/check-update', async (req, res) => {
        const clientVer = (req.query.clientVersion || req.query.currentVersion || req.query.version || '').replace(/^v/i, '').trim();
        let serverPkgVersion = process.env.APP_VERSION || '1.0.0';
        const pkgCandidates = [
            path.resolve(serverDir, '../package.json'),
            path.resolve(process.cwd(), 'package.json'),
            path.join(os.homedir(), 'The-Verity', 'package.json')
        ];
        for (const p of pkgCandidates) {
            try {
                const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (pkg.version) { serverPkgVersion = pkg.version; break; }
            } catch (_) { }
        }

        const currentVersion = clientVer || serverPkgVersion;
        let latestVersion = process.env.LATEST_APP_VERSION || serverPkgVersion;
        let githubDownloadUrl = null;
        const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';
        const homeDir = os.homedir();
        const candidateDirs = [
            path.resolve(serverDir, isAdmin ? '../release/Admin' : '../release/Users'),
            path.resolve(process.cwd(), isAdmin ? 'release/Admin' : 'release/Users'),
            path.resolve(serverDir, '../release'),
            path.resolve(process.cwd(), 'release'),
            path.resolve(serverDir, '../dist'),
            path.resolve(process.cwd(), 'dist'),
            path.join(homeDir, 'The-Verity', isAdmin ? 'release/Admin' : 'release/Users'),
            path.join(homeDir, 'The-Verity', 'release'),
            process.env.RELEASE_DIR,
            process.env.VERITY_RELEASE_DIR
        ].filter(Boolean);

        const localInstallers = findLocalInstallers(candidateDirs, isAdmin);
        if (localInstallers.length > 0 && compareSemver(localInstallers[0].version, latestVersion)) {
            latestVersion = localInstallers[0].version;
        }

        for (const dir of candidateDirs) {
            const ymlPath = path.join(dir, 'latest.yml');
            if (fs.existsSync(ymlPath)) {
                try {
                    const match = fs.readFileSync(ymlPath, 'utf8').match(/version:\s*([0-9.]+)/i);
                    if (match && match[1] && compareSemver(match[1].trim(), latestVersion)) {
                        latestVersion = match[1].trim();
                    }
                } catch (_) { }
            }
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            const ghRepo = (process.env.GITHUB_REPO || 'TheVerityCvSU/TheVerity').trim();
            const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/releases/latest`, {
                headers: { 'User-Agent': 'The-Verity-App' },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (ghRes.ok) {
                const releaseData = await ghRes.json();
                const tagName = (releaseData.tag_name || '').replace(/^v/i, '').trim();
                if (tagName && compareSemver(tagName, latestVersion)) {
                    latestVersion = tagName;
                    const asset = (releaseData.assets || []).find(a =>
                        isAdmin ? /admin.*\.exe$/i.test(a.name) : /\.exe$/i.test(a.name) && !/admin/i.test(a.name)
                    );
                    if (asset?.browser_download_url) githubDownloadUrl = asset.browser_download_url;
                }
            }
        } catch (_) { }

        if (!githubDownloadUrl && localInstallers.length > 0 && !process.env.LATEST_APP_VERSION) {
            latestVersion = localInstallers[0].version;
        }

        const forceUpdate = req.query.force === 'true' || req.query.force === '1';
        const updateAvailable = forceUpdate || compareSemver(latestVersion, currentVersion);

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

        let finalDownloadUrl = `${baseUrl}/api/download-update${downloadQuery}`;
        if (!isLocalServer && (process.env.UPDATE_DOWNLOAD_URL || githubDownloadUrl)) {
            finalDownloadUrl = process.env.UPDATE_DOWNLOAD_URL || githubDownloadUrl;
        }

        res.json({
            currentVersion,
            latestVersion,
            updateAvailable,
            downloadUrl: finalDownloadUrl,
            releaseNotes: `Version ${latestVersion}: Enhanced proctoring stability, UI performance optimizations, and security patches.`
        });
    });

    app.get('/api/download-update', async (req, res) => {
        const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';
        const reqVersion = (req.query.version || req.query.v || '').trim();
        const homeDir = os.homedir();
        const candidateDirs = [
            path.resolve(serverDir, isAdmin ? '../release/Admin' : '../release/Users'),
            path.resolve(process.cwd(), isAdmin ? 'release/Admin' : 'release/Users'),
            path.resolve(serverDir, '../release'),
            path.resolve(process.cwd(), 'release'),
            path.resolve(serverDir, '../dist'),
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

        const found = findLocalInstallers(candidateDirs, isAdmin);
        if (found.length > 0) {
            let best = found[0];
            if (reqVersion) {
                const exactMatch = found.find(f => f.version === reqVersion);
                if (exactMatch) best = exactMatch;
            }
            return res.download(best.path, best.filename);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const ghRepo = (process.env.GITHUB_REPO || 'TheVerityCvSU/TheVerity').trim();
            const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/releases/latest`, {
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

    app.get('/health', async (req, res) => {
        try {
            await db.get('SELECT 1');
            res.status(200).json({
                status: 'operational',
                app: 'the-verity',
                uptime: process.uptime(),
                db: 'connected',
                provider: db.providerName,
                hasCloudDb: db.isPostgres,
                isHost: checkIsHost(),
                lanIps: getValidLanIps(),
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

    app.post('/api/sync', authenticateTokenOrLoopback, async (req, res) => {
        try {
            const { syncBidirectional } = require('../db/cloudSync');
            const syncResult = await syncBidirectional();
            res.status(200).json({ message: 'Sync complete', ...syncResult });
        } catch (e) {
            res.status(500).json({ message: 'Sync failed', error: e.message });
        }
    });

    app.get('/api/sync-status', (req, res) => {
        try {
            const { getSyncStatus } = require('../db/cloudSync');
            res.status(200).json(getSyncStatus());
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/maintenance-status', async (req, res) => {
        res.status(200).json(await getMaintenanceStatus());
    });

    app.get('/kiosk-settings', async (req, res) => {
        res.status(200).json({ settings: await getKioskSettings() });
    });

    app.get('/api/system/dotnet-status', (req, res) => {
        try {
            res.status(200).json(dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV));
        } catch (e) {
            res.status(500).json({ installed: false, error: e.message, stage: 'idle' });
        }
    });

    app.post('/api/system/install-dotnet', authenticateTokenOrLoopback, async (req, res) => {
        if (req.user && !['teacher', 'instructor', 'admin'].includes(String(req.user.role || '').toLowerCase()) && !isLoopbackAddress(req.socket?.remoteAddress || req.ip)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        try {
            dotnetManager.startInstallDotnet(io, () => {
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

    app.post('/api/system/cancel-dotnet-install', authenticateTokenOrLoopback, (req, res) => {
        if (req.user && !['teacher', 'instructor', 'admin'].includes(String(req.user.role || '').toLowerCase()) && !isLoopbackAddress(req.socket?.remoteAddress || req.ip)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        try {
            res.status(200).json(dotnetManager.cancelInstallDotnet(io));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/active-activities', (req, res) => {
        try {
            res.status(200).json({
                counts: getActiveActivitiesMap(req.query.classroomId),
                classroomCounts: getActiveClassroomsMap()
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });
}

module.exports = { registerSystemRoutes };
