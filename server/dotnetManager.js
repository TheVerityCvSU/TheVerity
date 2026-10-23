const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const DOTNET_INSTALLER_URL = 'https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.exe';

// Maintain singleton installation state
let activeDownloadRequest = null;
let activeInstallerProcess = null;

let state = {
    installed: false,
    version: null,
    targetFramework: null,
    stage: 'idle', // 'idle' | 'checking' | 'downloading' | 'installing' | 'completed' | 'error'
    percent: 0,
    downloadedMB: '0.0',
    totalMB: '0.0',
    speed: '0 KB/s',
    error: null,
    message: ''
};

// Known default paths on Windows
const STANDARD_DOTNET_PATHS = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'dotnet', 'dotnet.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'dotnet', 'dotnet.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft', 'dotnet', 'dotnet.exe')
];

/**
 * Ensure C:\Program Files\dotnet is in PATH if dotnet.exe is found there.
 */
function ensureDotnetInPath() {
    for (const exePath of STANDARD_DOTNET_PATHS) {
        if (fs.existsSync(exePath)) {
            const dir = path.dirname(exePath);
            const currentPath = process.env.PATH || '';
            if (!currentPath.split(path.delimiter).some(p => p.toLowerCase() === dir.toLowerCase())) {
                process.env.PATH = `${dir}${path.delimiter}${currentPath}`;
                console.log(`[DotnetManager] Appended ${dir} to process.env.PATH`);
            }
            return exePath;
        }
    }
    return null;
}

/**
 * Detect whether .NET SDK is currently installed and working.
 */
function checkDotnetStatus(env = process.env) {
    ensureDotnetInPath();

    try {
        const output = execSync('dotnet --version', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            env: { ...process.env, ...env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' }
        }).trim();

        const major = parseInt(output.split('.')[0], 10);
        const targetFramework = (!isNaN(major) && major >= 6) ? `net${major}.0` : 'net8.0';

        state.installed = true;
        state.version = output;
        state.targetFramework = targetFramework;
        state.error = null;
        if (state.stage === 'idle' || state.stage === 'checking') {
            state.stage = 'completed';
        }
        return { ...state };
    } catch (e) {
        state.installed = false;
        state.version = null;
        state.targetFramework = null;
        state.error = e.message;
        if (state.stage !== 'downloading' && state.stage !== 'installing') {
            state.stage = 'idle';
        }
        return { ...state };
    }
}

/**
 * Download file from URL with support for HTTP 301/302 redirects.
 */
function downloadFileWithRedirect(url, destPath, onProgress, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return reject(new Error('Too many redirects while downloading .NET SDK'));

        const parsed = new URL(url);
        const client = parsed.protocol === 'https:' ? https : http;

        const req = client.get(url, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = new URL(redirectUrl, url).href;
                }
                res.resume();
                return downloadFileWithRedirect(redirectUrl, destPath, onProgress, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Download failed with HTTP ${res.statusCode} ${res.statusMessage}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            let lastReportTime = Date.now();
            let lastBytes = 0;

            const fileStream = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const now = Date.now();
                if (now - lastReportTime >= 350) {
                    const elapsedSec = (now - lastReportTime) / 1000;
                    const deltaBytes = downloadedBytes - lastBytes;
                    const bps = elapsedSec > 0 ? deltaBytes / elapsedSec : 0;
                    const speed = bps > 1048576
                        ? `${(bps / 1048576).toFixed(1)} MB/s`
                        : `${(bps / 1024).toFixed(0)} KB/s`;

                    const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
                    if (onProgress) {
                        onProgress({
                            percent,
                            downloadedBytes,
                            totalBytes,
                            downloadedMB: (downloadedBytes / 1048576).toFixed(1),
                            totalMB: (totalBytes / 1048576).toFixed(1),
                            speed
                        });
                    }
                    lastReportTime = now;
                    lastBytes = downloadedBytes;
                }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => resolve({ destPath, totalBytes: downloadedBytes }));
            });

            fileStream.on('error', (err) => {
                try { fs.unlinkSync(destPath); } catch (_) {}
                reject(err);
            });
        });

        activeDownloadRequest = req;

        req.on('error', (err) => {
            activeDownloadRequest = null;
            try { fs.unlinkSync(destPath); } catch (_) {}
            reject(err);
        });

        req.setTimeout(60000, () => {
            req.destroy();
            activeDownloadRequest = null;
            try { fs.unlinkSync(destPath); } catch (_) {}
            reject(new Error('Download connection timed out. Please check your internet connection.'));
        });
    });
}

/**
 * Start the automated download and installation flow.
 * Broadcasts progress updates via Socket.IO if provided.
 */
async function startInstallDotnet(io = null, onReadyCallback = null) {
    // If already downloading or installing, return current status
    if (state.stage === 'downloading' || state.stage === 'installing') {
        return { ...state };
    }

    // Check if already installed
    const current = checkDotnetStatus();
    if (current.installed) {
        state.stage = 'completed';
        state.percent = 100;
        state.message = `.NET SDK ${current.version} is already installed and ready.`;
        if (io) io.emit('dotnet_setup_progress', { ...state });
        return { ...state };
    }

    const tempInstallerPath = path.join(os.tmpdir(), `verity_dotnet_sdk_${Date.now()}.exe`);

    try {
        state.stage = 'downloading';
        state.percent = 0;
        state.downloadedMB = '0.0';
        state.totalMB = '0.0';
        state.speed = 'Connecting...';
        state.error = null;
        state.message = 'Connecting to Microsoft CDN for official .NET 8 SDK...';
        if (io) io.emit('dotnet_setup_progress', { ...state });

        console.log(`[DotnetManager] Starting .NET SDK download from ${DOTNET_INSTALLER_URL}...`);

        await downloadFileWithRedirect(DOTNET_INSTALLER_URL, tempInstallerPath, (progress) => {
            state.percent = progress.percent;
            state.downloadedMB = progress.downloadedMB;
            state.totalMB = progress.totalMB;
            state.speed = progress.speed;
            state.message = `Downloading Microsoft .NET SDK (${progress.downloadedMB} / ${progress.totalMB} MB)...`;
            if (io) io.emit('dotnet_setup_progress', { ...state });
        });

        activeDownloadRequest = null;

        // Stage: Installing
        state.stage = 'installing';
        state.percent = 100;
        state.speed = '';
        state.message = 'Running silent installation... Please approve the Windows Security (UAC) prompt if prompted.';
        if (io) io.emit('dotnet_setup_progress', { ...state });

        console.log(`[DotnetManager] Download complete (${tempInstallerPath}). Launching silent installer...`);

        // Execute silent installer with UAC elevation on Windows
        await new Promise((resolve, reject) => {
            const escapedPath = tempInstallerPath.replace(/"/g, '`"');
            // PowerShell Start-Process with -Verb RunAs triggers UAC prompt for system install into Program Files
            const psCommand = `Start-Process -FilePath "${escapedPath}" -ArgumentList "/install", "/quiet", "/norestart" -Verb RunAs -Wait -PassThru`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, { windowsHide: true }, (err, stdout, stderr) => {
                if (err) {
                    if (err.message && (err.message.includes('canceled by the user') || err.code === 1223)) {
                        return reject(new Error('Installation was cancelled by user (administrator permission was not granted).'));
                    }
                    return reject(new Error(`Installer execution failed: ${err.message}`));
                }
                resolve();
            });
        });

        // Cleanup temporary installer file
        try {
            if (fs.existsSync(tempInstallerPath)) fs.unlinkSync(tempInstallerPath);
        } catch (_) {}

        // Verify and refresh PATH
        ensureDotnetInPath();
        const verified = checkDotnetStatus();

        if (verified.installed) {
            state.stage = 'completed';
            state.installed = true;
            state.version = verified.version;
            state.targetFramework = verified.targetFramework;
            state.error = null;
            state.message = `Successfully installed Microsoft .NET SDK ${verified.version}! C# Compiler is ready.`;
            console.log(`[DotnetManager] Verified: .NET SDK ${verified.version} (${verified.targetFramework}) ready.`);

            if (typeof onReadyCallback === 'function') {
                try { onReadyCallback(verified); } catch (_) {}
            }

            if (io) io.emit('dotnet_setup_progress', { ...state });
            return { ...state };
        } else {
            throw new Error('Installer completed, but dotnet command was not found in Program Files. A computer restart may be required.');
        }

    } catch (err) {
        console.error('[DotnetManager] Installation error:', err.message);
        state.stage = 'error';
        state.error = err.message;
        state.message = err.message;
        activeDownloadRequest = null;

        // Cleanup temp file if error
        try {
            if (fs.existsSync(tempInstallerPath)) fs.unlinkSync(tempInstallerPath);
        } catch (_) {}

        if (io) io.emit('dotnet_setup_progress', { ...state });
        return { ...state };
    }
}

/**
 * Cancel an ongoing download if in progress.
 */
function cancelInstallDotnet(io = null) {
    if (activeDownloadRequest) {
        try {
            activeDownloadRequest.destroy();
        } catch (_) {}
        activeDownloadRequest = null;
    }

    state.stage = 'idle';
    state.percent = 0;
    state.error = 'Installation cancelled.';
    state.message = 'Installation was cancelled.';

    if (io) io.emit('dotnet_setup_progress', { ...state });
    return { ...state };
}

function getDotnetState() {
    return { ...state };
}

module.exports = {
    checkDotnetStatus,
    startInstallDotnet,
    cancelInstallDotnet,
    getDotnetState,
    ensureDotnetInPath
};
