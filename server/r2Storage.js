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
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

let S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, GetBucketCorsCommand, PutBucketCorsCommand;
try {
    ({
        S3Client,
        PutObjectCommand,
        GetObjectCommand,
        HeadObjectCommand,
        GetBucketCorsCommand,
        PutBucketCorsCommand
    } = require('@aws-sdk/client-s3'));
} catch (_) {
    // SDK not installed
}

let cachedClient = null;
let cachedConfigKey = null;
const inFlightDownloads = new Map();
const R2_EXISTS_CACHE_TTL_MS = 10 * 60 * 1000;
const knownR2Keys = new Map();
let corsEnsured = false;

function markKeyInR2(filename) {
    if (!filename) return;
    knownR2Keys.set(path.basename(String(filename)), Date.now() + R2_EXISTS_CACHE_TTL_MS);
}

function invalidateR2KeyCache(filename) {
    if (!filename) return;
    knownR2Keys.delete(path.basename(String(filename)));
}

function isKeyCachedInR2(filename) {
    if (!filename) return false;
    const key = path.basename(String(filename));
    const expiresAt = knownR2Keys.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
        knownR2Keys.delete(key);
        return false;
    }
    return true;
}

function encodeRfc3986(str) {
    return encodeURIComponent(String(str)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeRfc3986Path(pathStr) {
    return String(pathStr).split('/').map(encodeRfc3986).join('/');
}

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
        markKeyInR2(filename);
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
            markKeyInR2(filename);
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
        markKeyInR2(filename);
        return true;
    } catch (_) {
        return false;
    }
}

async function existsInR2Cached(filename) {
    if (isKeyCachedInR2(filename)) return true;
    return existsInR2(filename);
}

/**
 * Generates an AWS SigV4 presigned GET/HEAD URL directly against Cloudflare R2's
 * S3-compatible endpoint so clients download/stream media directly from R2 (0 Render egress).
 */
function getPresignedR2Url(filename, { method = 'GET', expiresIn = 3600, downloadFilename = '', now = new Date() } = {}) {
    if (!isR2Configured() || !filename) return null;
    const cfg = getR2Config();
    let parsedEndpoint;
    try {
        parsedEndpoint = new URL(cfg.endpoint);
    } catch (_) {
        return null;
    }

    const httpMethod = String(method || 'GET').toUpperCase() === 'HEAD' ? 'HEAD' : 'GET';
    const ttlSeconds = Math.max(60, Math.min(604800, Number(expiresIn) || 3600));
    const key = getObjectKey(filename);
    const basePath = parsedEndpoint.pathname.replace(/\/$/, '');
    const canonicalUri = encodeRfc3986Path(`${basePath}/${cfg.bucket}/${key}`);

    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const queryParams = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(ttlSeconds),
        'X-Amz-SignedHeaders': 'host',
    };

    if (downloadFilename) {
        const cleanName = String(downloadFilename).trim() || path.basename(filename).replace(/^\d+_/, '') || 'download';
        const safeAscii = cleanName.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7E]/g, '_') || 'download';
        const encodedUtf8 = encodeURIComponent(cleanName);
        queryParams['response-content-disposition'] = `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
    }

    const canonicalQueryString = Object.keys(queryParams)
        .map(k => [encodeRfc3986(k), encodeRfc3986(queryParams[k])])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');

    const host = parsedEndpoint.host;
    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
        httpMethod,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        'host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        hashedCanonicalRequest,
    ].join('\n');

    const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data, 'utf8').digest();
    const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return `${parsedEndpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/**
 * Returns the direct Cloudflare R2 URL for a file:
 * uses R2_PUBLIC_URL for inline media when set, or a signed R2 URL otherwise
 * (and always uses a signed URL for ?download=1 so Content-Disposition works).
 */
function getDirectMediaUrl(filename, { method = 'GET', expiresIn = 3600, downloadFilename = '' } = {}) {
    if (!isR2Configured() || !filename) return null;
    const cfg = getR2Config();
    if (!downloadFilename && cfg.publicUrl) {
        const key = getObjectKey(filename);
        return {
            url: `${cfg.publicUrl}/${encodeRfc3986Path(key)}`,
            isPublic: true,
        };
    }
    const signedUrl = getPresignedR2Url(filename, { method, expiresIn, downloadFilename });
    if (!signedUrl) return null;
    return {
        url: signedUrl,
        isPublic: false,
    };
}

/**
 * Ensures the R2 bucket allows browser GET/HEAD CORS requests so fetch()-based previews
 * (.docx / .txt) work seamlessly when redirected to R2. Fails silently if token lacks bucket admin scope.
 */
async function ensureBucketCors() {
    if (corsEnsured || !isR2Configured() || !GetBucketCorsCommand || !PutBucketCorsCommand) return false;
    corsEnsured = true;
    const client = getClient();
    const cfg = getR2Config();
    if (!client) return false;
    try {
        const existing = await client.send(new GetBucketCorsCommand({ Bucket: cfg.bucket })).catch(() => null);
        const rules = Array.isArray(existing?.CORSRules) ? existing.CORSRules : [];
        const hasReadCors = rules.some(r =>
            Array.isArray(r.AllowedOrigins) && r.AllowedOrigins.includes('*') &&
            Array.isArray(r.AllowedMethods) && r.AllowedMethods.includes('GET')
        );
        if (hasReadCors) return true;

        await client.send(new PutBucketCorsCommand({
            Bucket: cfg.bucket,
            CORSConfiguration: {
                CORSRules: [
                    ...rules,
                    {
                        AllowedOrigins: ['*'],
                        AllowedMethods: ['GET', 'HEAD'],
                        AllowedHeaders: ['*'],
                        ExposeHeaders: ['Content-Length', 'Content-Range', 'Content-Disposition', 'ETag', 'Accept-Ranges'],
                        MaxAgeSeconds: 86400,
                    },
                ],
            },
        }));
        console.log(`[R2 Storage] Verified/enabled public GET/HEAD CORS on bucket ${cfg.bucket}`);
        return true;
    } catch (err) {
        console.log(`[R2 Storage] Bucket CORS check skipped (${err?.name || err?.message || 'no permission'})`);
        return false;
    }
}

module.exports = {
    isR2Configured,
    getR2Config,
    uploadFileToR2,
    downloadFileFromR2,
    existsInR2,
    existsInR2Cached,
    invalidateR2KeyCache,
    getPresignedR2Url,
    getDirectMediaUrl,
    ensureBucketCors,
};
