const jwt = require('jsonwebtoken');

/**
 * Builds authentication, RBAC, admin IP whitelist, and OTP/login rate-limiting middleware.
 */
function createAuthMiddleware({ JWT_SECRET, IS_RENDER_CLOUD, db = null }) {
    const adminLoginAttempts = new Map();
    const userLoginAttempts = new Map();
    const otpAttemptCounts = new Map();
    const otpSendCooldowns = new Map();

    const checkOtpSendRateLimit = (key, maxPerWindow = 5, windowMs = 15 * 60 * 1000) => {
        const now = Date.now();
        const rec = otpSendCooldowns.get(key) || { count: 0, resetTime: now + windowMs };
        if (now > rec.resetTime) {
            rec.count = 0;
            rec.resetTime = now + windowMs;
        }
        if (rec.count >= maxPerWindow) {
            return false;
        }
        rec.count += 1;
        otpSendCooldowns.set(key, rec);
        return true;
    };

    const isIpWhitelisted = (ip) => {
        const rawAllowed = (process.env.ADMIN_ALLOWED_IPS || '').trim();
        if (!rawAllowed || rawAllowed.includes('*')) {
            return true;
        }
        if (!ip) return true;
        const cleanIp = String(ip).replace(/^::ffff:/i, '');
        const allowedEnv = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
        const defaultAllowed = ['127.0.0.1', '::1', 'localhost', '192.168.8.115', '131.226.102.72'];
        if (defaultAllowed.includes(cleanIp) || allowedEnv.includes(cleanIp)) {
            return true;
        }
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(cleanIp)) {
            return true;
        }
        return false;
    };

    const adminIpWhitelist = (req, res, next) => {
        let clientIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
        if (typeof clientIp === 'string' && clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }
        if (!isIpWhitelisted(clientIp)) {
            console.warn(`[SECURITY ALERT] Admin access blocked for non-whitelisted IP: ${clientIp}`);
            return res.status(403).json({ message: 'Access denied, your not eligible for admin access' });
        }
        next();
    };

    const adminLoginRateLimiter = (req, res, next) => {
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
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

    const loginRateLimiter = (req, res, next) => {
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const rawId = String(req.body?.email || req.body?.username || req.body?.identifier || '').trim().toLowerCase();
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;

        const ipKey = `ip:${clientIp}`;
        const ipRec = userLoginAttempts.get(ipKey) || { count: 0, resetTime: now + windowMs };
        if (now > ipRec.resetTime) {
            ipRec.count = 0;
            ipRec.resetTime = now + windowMs;
        }
        if (ipRec.count >= 60) {
            const remainingMinutes = Math.ceil((ipRec.resetTime - now) / 60000);
            return res.status(429).json({
                message: `Too many failed login attempts from this network. Please wait ${remainingMinutes} minute(s).`
            });
        }

        const acctKey = rawId ? `acct:${clientIp}:${rawId}` : null;
        let acctRec = null;
        if (acctKey) {
            acctRec = userLoginAttempts.get(acctKey) || { count: 0, resetTime: now + windowMs };
            if (now > acctRec.resetTime) {
                acctRec.count = 0;
                acctRec.resetTime = now + windowMs;
            }
            if (acctRec.count >= 8) {
                const remainingMinutes = Math.ceil((acctRec.resetTime - now) / 60000);
                return res.status(429).json({
                    message: `Too many failed login attempts for this account. Please wait ${remainingMinutes} minute(s).`
                });
            }
        }

        req.loginRateMeta = {
            recordFailure: () => {
                ipRec.count += 1;
                userLoginAttempts.set(ipKey, ipRec);
                if (acctKey && acctRec) {
                    acctRec.count += 1;
                    userLoginAttempts.set(acctKey, acctRec);
                }
            },
            clearSuccess: () => {
                if (acctKey) userLoginAttempts.delete(acctKey);
            }
        };
        next();
    };

    const isLoopbackAddress = (ip) => {
        if (!ip) return false;
        const clean = String(ip).split(',')[0].trim().replace(/^::ffff:/i, '');
        return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost';
    };

    const verifySessionToken = (token) => {
        if (!token || typeof token !== 'string') return null;
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (_) {
            return null;
        }
    };

    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
        if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

        const user = verifySessionToken(token);
        if (!user) return res.status(403).json({ message: 'Invalid token.' });
        if (!db) {
            req.user = user;
            return next();
        }
        const roleLower = String(user.role || '').toLowerCase();
        const tbl = roleLower === 'admin' ? 'admin_users' : 'users';
        const lookupEmail = String(user.email || '').trim().toLowerCase();
        const promise = lookupEmail
            ? db.get(`SELECT id, status, role FROM ${tbl} WHERE id = ? OR LOWER(email) = ?`, user.id ?? -1, lookupEmail)
            : db.get(`SELECT id, status, role FROM ${tbl} WHERE id = ?`, user.id ?? -1);
        Promise.resolve(promise)
            .then((row) => {
                if (!row) {
                    return res.status(401).json({ message: 'Account no longer exists. Please sign in again.' });
                }
                const statusLower = String(row.status || 'Active').toLowerCase();
                if (statusLower === 'disabled' || statusLower === 'suspended' || statusLower === 'pending') {
                    return res.status(403).json({ message: `Account is ${statusLower}. Access denied.` });
                }
                req.user = user;
                next();
            })
            .catch(() => {
                req.user = user;
                next();
            });
    };

    const authenticateTokenOrLoopback = (req, res, next) => {
        const remoteIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
        if (token) {
            const user = verifySessionToken(token);
            if (user) {
                req.user = user;
                return next();
            }
            return res.status(403).json({ message: 'Invalid token.' });
        }
        if (!IS_RENDER_CLOUD && isLoopbackAddress(remoteIp)) {
            return next();
        }
        return res.status(401).json({ message: 'Authentication required.' });
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

    return {
        adminLoginAttempts,
        userLoginAttempts,
        otpAttemptCounts,
        checkOtpSendRateLimit,
        isIpWhitelisted,
        adminIpWhitelist,
        adminLoginRateLimiter,
        loginRateLimiter,
        isLoopbackAddress,
        verifySessionToken,
        authenticateToken,
        authenticateTokenOrLoopback,
        requireRole
    };
}

module.exports = { createAuthMiddleware };
