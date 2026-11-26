const fs = require('fs');
const path = require('path');
const https = require('https');

const TARGET_DIR = path.join(__dirname, '..', 'build');
const TARGET_PATH = path.join(TARGET_DIR, 'dotnet-sdk-win-x64.exe');
const DOTNET_URL = 'https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.exe';
const MIN_SDK_BYTES = 100 * 1024 * 1024;

function downloadFile(url, destPath, redirectsLeft = 8) {
    return new Promise((resolve, reject) => {
        if (redirectsLeft < 0) {
            return reject(new Error('Too many redirects while downloading .NET SDK.'));
        }
        let parsed;
        try {
            parsed = new URL(url);
        } catch (err) {
            return reject(err);
        }
        if (parsed.protocol !== 'https:') {
            return reject(new Error(`Refusing non-HTTPS .NET SDK URL: ${url}`));
        }

        const tmpPath = `${destPath}.tmp`;
        try { fs.unlinkSync(tmpPath); } catch (_) {}

        const req = https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const nextUrl = new URL(res.headers.location, url).href;
                return downloadFile(nextUrl, destPath, redirectsLeft - 1).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
            }

            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const fileStream = fs.createWriteStream(tmpPath);
            let settled = false;

            const cleanupAndReject = (err) => {
                if (settled) return;
                settled = true;
                try { fileStream.destroy(); } catch (_) {}
                fs.unlink(tmpPath, () => {});
                reject(err);
            };

            res.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total > 0 && downloaded % (10 * 1024 * 1024) < chunk.length) {
                    const pct = ((downloaded / total) * 100).toFixed(1);
                    process.stdout.write(`\rDownloading .NET SDK for installer bundle... ${pct}% (${(downloaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB)`);
                }
            });

            res.on('aborted', () => cleanupAndReject(new Error('Download aborted unexpectedly.')));
            res.on('error', cleanupAndReject);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => {
                    if (settled) return;
                    try {
                        const finalSize = fs.statSync(tmpPath).size;
                        if (total > 0 && finalSize !== total) {
                            return cleanupAndReject(new Error(`Incomplete download (${finalSize} of ${total} bytes)`));
                        }
                        if (finalSize < MIN_SDK_BYTES) {
                            return cleanupAndReject(new Error(`Downloaded .NET SDK is unexpectedly small (${finalSize} bytes)`));
                        }
                        fs.renameSync(tmpPath, destPath);
                        settled = true;
                        console.log(`\n[prepare-dotnet-sdk] Download complete: ${destPath} (${(finalSize / 1048576).toFixed(1)} MB)`);
                        resolve();
                    } catch (err) {
                        cleanupAndReject(err);
                    }
                });
            });

            fileStream.on('error', cleanupAndReject);
        });

        req.setTimeout(60000, () => {
            try { req.destroy(new Error('.NET SDK download timed out.')); } catch (_) {}
        });
        req.on('error', reject);
    });
}

async function main() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    if (fs.existsSync(TARGET_PATH)) {
        const size = fs.statSync(TARGET_PATH).size;
        if (size > 150 * 1024 * 1024) {
            console.log(`[prepare-dotnet-sdk] Bundled .NET SDK installer already present (${(size / 1048576).toFixed(1)} MB). Ready for packaging.`);
            return;
        }
        console.log(`[prepare-dotnet-sdk] Existing file is incomplete (${size} bytes). Re-downloading...`);
    }

    console.log('[prepare-dotnet-sdk] Downloading official Microsoft .NET 8.0 SDK to bundle inside Verity installer...');
    await downloadFile(DOTNET_URL, TARGET_PATH);
}

main().catch((err) => {
    console.error('[prepare-dotnet-sdk] Error preparing .NET SDK:', err.message);
    process.exit(1);
});
