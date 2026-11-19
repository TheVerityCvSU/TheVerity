/**
 * Cloudflare R2 (S3-compatible) media storage adapter for The Verity.
 *
 * Configure via environment variables in server/.env (and Render dashboard):
 *   R2_ACCOUNT_ID=...
 *   R2_ACCESS_KEY_ID=...
 *   R2_SECRET_ACCESS_KEY=...
 *   R2_BUCKET_NAME=...
 *   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com   (optional, derived from R2_ACCOUNT_ID)
 *   R2_PUBLIC_URL=https://pub-xxxx.r2.dev                       (optional)
 */
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

let S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand;
try {
    ({ S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3'));
} catch (_) {
    // SDK not installed
}

let cachedClient = null;
let cachedConfigKey = null;
const inFlightDownloads = new Map();

function getR2Config() {
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucket = (process.env.R2_BUCKET_NAME || '').trim();
    const endpoint = (process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).trim();
    const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
    return { accountId, accessKeyId, secretAccessKey, bucket, endpoint, publicUrl };
}

function isR2Configured() {
    if (!S3Client) return false;
    const cfg = getR2Config();
    return Boolean(cfg.endpoint && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
}

function getClient() {
    if (!isR2Configured()) return null;
    const cfg = getR2Config();
    const key = `${cfg.endpoint}|${cfg.accessKeyId}|${cfg.bucket}`;
    if (cachedClient && cachedConfigKey === key) return cachedClient;

    cachedClient = new S3Client({
        region: 'auto',
        endpoint: cfg.endpoint,
        credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
        },
        forcePathStyle: true,
    });
    cachedConfigKey = key;
    return cachedClient;
}

function getObjectKey(filename) {
    return `uploads/${path.basename(String(filename || ''))}`;
}

async function uploadFileToR2(filename, filePath, contentType = 'application/octet-stream') {
    const client = getClient();
    if (!client) return { uploaded: false, reason: 'not_configured' };
    if (!fs.existsSync(filePath)) return { uploaded: false, reason: 'missing_local_file' };

    const cfg = getR2Config();
    const key = getObjectKey(filename);
    const stat = fs.statSync(filePath);
    const bodyStream = fs.createReadStream(filePath);

    try {
        await client.send(new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: key,
            Body: bodyStream,
            ContentLength: stat.size,
            ContentType: contentType || 'application/octet-stream',
            CacheControl: 'public, max-age=31536000',
        }));
        console.log(`[R2 Storage] Uploaded ${filename} (${stat.size} bytes) to bucket ${cfg.bucket}`);
        return { uploaded: true, key };
    } catch (err) {
        console.error(`[R2 Storage] Upload failed for ${filename}:`, err.message);
        return { uploaded: false, error: err.message };
    }
}

async function downloadFileFromR2(filename, targetPath) {
    const client = getClient();
    if (!client) return false;
    if (fs.existsSync(targetPath)) return true;

    if (inFlightDownloads.has(filename)) {
        return inFlightDownloads.get(filename);
    }

    const cfg = getR2Config();
    const key = getObjectKey(filename);

    const promise = (async () => {
        const partPath = `${targetPath}.${Date.now()}.r2part`;
        try {
            const response = await client.send(new GetObjectCommand({
                Bucket: cfg.bucket,
                Key: key,
            }));
            if (!response || !response.Body) return false;

            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const bodyNodeStream = typeof response.Body.pipe === 'function'
                ? response.Body
                : Readable.fromWeb(response.Body);

            const ws = fs.createWriteStream(partPath);
            await pipeline(bodyNodeStream, ws);
            fs.renameSync(partPath, targetPath);
            console.log(`[R2 Storage] Hydrated ${filename} from R2 into local cache`);
            return true;
        } catch (err) {
            try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (_) { }
            if (err?.name !== 'NoSuchKey' && err?.$metadata?.httpStatusCode !== 404) {
                console.warn(`[R2 Storage] Download notice for ${filename}:`, err.message);
            }
            return false;
        } finally {
            inFlightDownloads.delete(filename);
        }
    })();

    inFlightDownloads.set(filename, promise);
    return promise;
}

async function existsInR2(filename) {
    const client = getClient();
    if (!client) return false;
    const cfg = getR2Config();
    try {
        await client.send(new HeadObjectCommand({
            Bucket: cfg.bucket,
            Key: getObjectKey(filename),
        }));
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = {
    isR2Configured,
    getR2Config,
    uploadFileToR2,
    downloadFileFromR2,
    existsInR2,
};
