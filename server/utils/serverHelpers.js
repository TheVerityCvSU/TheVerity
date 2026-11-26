const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * Formats the local calendar date as YYYY-MM-DD for security_flags partitioning.
 */
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resolves the active JWT signing secret from environment or persistent local key file.
 */
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

/**
 * Checks whether an HTTP/Socket Origin header is permitted by Verity CORS policy.
 */
function isAllowedCorsOrigin(origin, extraAllowedOrigins = new Set()) {
    if (!origin || origin === 'null' || origin.startsWith('file://')) return true;
    const clean = String(origin).trim().replace(/\/$/, '');
    if (extraAllowedOrigins.has(clean)) return true;
    if (clean === 'https://the-verity.onrender.com' || clean === 'https://verity-2z4v.onrender.com') return true;
    try {
        const parsed = new URL(clean);
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
        if (parsed.protocol === 'https:' && (host === 'the-verity.vercel.app' || host.startsWith('the-verity-') || host.startsWith('verity-'))) {
            if (host.endsWith('.vercel.app')) return true;
        }
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return true;
    } catch (_) {
        return false;
    }
    return false;
}

/**
 * Enumerates non-internal IPv4 LAN addresses excluding link-local and VirtualBox ranges.
 */
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

/**
 * Extracts normalized client IP from an Express request or Socket.IO socket.
 */
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

/**
 * Determines whether this server process is acting as a primary ComLab LAN host.
 */
function isHostServerInstance({ dataDir, serverDir, isMainModule = false }) {
    const isExplicitClient = process.env.IS_LAN_HOST === 'false';
    return !isExplicitClient && Boolean(
        fs.existsSync(path.join(dataDir, 'host.flag')) ||
        fs.existsSync(path.join(serverDir, 'host.flag')) ||
        process.env.IS_LAN_HOST === 'true' ||
        process.env.IS_VERITY_ADMIN === 'true' ||
        process.argv.includes('--host') ||
        isMainModule
    );
}

/**
 * Formats and sends a 502 error response when OTP email delivery fails.
 */
function sendEmailDeliveryError(res, cleanEmail, emailResult) {
    const detail = emailResult?.error || 'Email provider delivery failed.';
    console.warn(`[AUTH] Email delivery failed for ${cleanEmail}: ${detail}`);
    const userMessage = emailResult?.simulated
        ? 'Email verification is not configured on this local server. Please connect to the online server or configure SMTP/Brevo.'
        : `Could not send verification code to ${cleanEmail}. ${detail}`;
    return res.status(502).json({
        message: userMessage,
        emailDeliveryFailed: true,
        error: detail
    });
}

module.exports = {
    todayKey,
    resolveJwtSecret,
    isAllowedCorsOrigin,
    getValidLanIps,
    extractClientIp,
    isHostServerInstance,
    sendEmailDeliveryError
};
