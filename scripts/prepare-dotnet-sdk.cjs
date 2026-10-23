const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TARGET_DIR = path.join(__dirname, '..', 'build');
const TARGET_PATH = path.join(TARGET_DIR, 'dotnet-sdk-win-x64.exe');
const DOTNET_URL = 'https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.exe';

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
            }

            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const fileStream = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total > 0 && downloaded % (10 * 1024 * 1024) < chunk.length) {
                    const pct = ((downloaded / total) * 100).toFixed(1);
                    process.stdout.write(`\rDownloading .NET SDK for installer bundle... ${pct}% (${(downloaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB)`);
                }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`\n[prepare-dotnet-sdk] Download complete: ${destPath} (${(fs.statSync(destPath).size / 1048576).toFixed(1)} MB)`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        }).on('error', reject);
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
