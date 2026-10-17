const path = require('path');
const fs = require('fs');

const envCandidates = [
    process.env.ENV_FILE_PATH,
    path.join(__dirname, '..', 'server', '.env'),
    path.join(__dirname, 'server', '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
    path.join(process.cwd(), 'server', '.env'),
    path.join(process.cwd(), '.env'),
].filter(Boolean);

for (const p of envCandidates) {
    if (fs.existsSync(p)) {
        try {
            require('dotenv').config({ path: p, override: true });
        } catch (_) {}
    }
}

const express = require('express');
const cors = require('cors');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');
const { Server } = require('socket.io');
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('./utils/emailService');
const db = require('./db/index.js');

const DATA_DIR = process.env.DATA_DIR || __dirname;

const app = express();
app.set('trust proxy', 1);
const JWT_SECRET = process.env.JWT_SECRET || 'verity_super_secret_key';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'verity_super_secret_key') {
    console.warn('⚠️  [SECURITY WARNING] JWT_SECRET is using the insecure default key in production! Set JWT_SECRET in your environment.');
}

app.use(cors());
// 150mb limit allows video uploads (mp4, webm, mov) with base64 overhead
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// --- SECURITY: BLOCK SEARCH ENGINE CRAWLERS & INDEXING ---
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
});

app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /\n');
});

// --- SECURITY: ADMIN IP WHITELISTING & RATE LIMITING ---
const adminLoginAttempts = new Map();

const isIpWhitelisted = (ip) => {
    if (!ip) return true;
    const cleanIp = ip.replace(/^.*:/, ''); // strip IPv6 prefix if mapped
    const allowedEnv = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    const defaultAllowed = ['127.0.0.1', '::1', 'localhost', '192.168.8.115', '131.226.102.72'];
    if (defaultAllowed.includes(cleanIp) || allowedEnv.includes(cleanIp) || allowedEnv.includes('*')) {
        return true;
    }
    return false;
};

const adminIpWhitelist = (req, res, next) => {
    // In Vercel/proxy environments, the real IP is in headers.
    let clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress;
    
    // x-forwarded-for can be a comma-separated list of IPs. The first one is the client.
    if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    if (!isIpWhitelisted(clientIp)) {
        console.warn(`[SECURITY ALERT] Admin access blocked for non-whitelisted IP: ${clientIp}`);
        return res.status(403).json({ message: `Access denied, your not eligible for admin access` });
    }
    next();
};

const adminLoginRateLimiter = (req, res, next) => {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 mins window
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

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user;
        next();
    });
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

// --- FILE UPLOADS (images / videos for assignments) ---
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Whitelist of permitted file extensions to prevent Stored XSS and arbitrary file execution
const ALLOWED_UPLOAD_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.mp4', '.webm', '.ogg', '.mov', '.quicktime', '.m4v',
    '.pdf', '.zip', '.txt'
]);

// Serve uploaded files statically at /uploads/<file> with security and media streaming headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    next();
}, express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.mov') {
            res.setHeader('Content-Type', 'video/quicktime');
        } else if (ext === '.mp4') {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (ext === '.webm') {
            res.setHeader('Content-Type', 'video/webm');
        }
    }
}));

// Raw binary upload endpoint (ideal for large videos like MP4, WebM, MOV without base64 overhead)
app.post('/upload-raw', (req, res) => {
    const rawFilename = req.query.filename || req.headers['x-filename'] || 'file.mp4';
    const ext = path.extname(rawFilename).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
        return res.status(400).json({ 
            message: `File type "${ext || 'unknown'}" is not allowed. Supported formats: images (.png, .jpg, .gif, .webp), videos (.mp4, .webm, .mov), pdf, zip, txt.` 
        });
    }

    const safeName = (rawFilename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;
    const targetPath = path.join(UPLOADS_DIR, unique);
    const writeStream = fs.createWriteStream(targetPath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        res.status(201).json({ url: `${protocol}://${host}/uploads/${unique}` });
    });

    writeStream.on('error', (err) => {
        console.error('Upload stream error:', err);
        res.status(500).json({ message: 'Failed to write upload stream' });
    });
});

// Accepts { filename, dataUrl } (dataUrl = "data:<mime>;base64,<data>"),
// writes the file to /uploads, and returns its public URL.
app.post('/upload', (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
}, (req, res) => {
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
        return res.status(400).json({ 
            message: `File type "${ext || 'unknown'}" is not allowed. Supported formats: images (.png, .jpg, .gif, .webp), videos (.mp4, .webm, .mov), pdf, zip, txt.` 
        });
    }

    const buffer = Buffer.from(match[2], 'base64');
    // Build a safe, unique filename.
    const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, unique), buffer);
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    res.status(201).json({ url: `${protocol}://${host}/uploads/${unique}` });
});

app.get('/api/check-update', (req, res) => {
    const currentVersion = '1.0.0';
    const forceUpdate = req.query.force === 'true' || req.query.force === '1';
    const latestVersion = forceUpdate ? '1.0.1' : (process.env.LATEST_APP_VERSION || currentVersion);
    const updateAvailable = latestVersion !== currentVersion;

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';
    const downloadQuery = isAdmin ? '?app=admin' : '';

    res.json({
        currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl: process.env.UPDATE_DOWNLOAD_URL || `${baseUrl}/api/download-update${downloadQuery}`,
        releaseNotes: 'Version ' + latestVersion + ': Enhanced proctoring stability, UI performance optimizations, and security patches.'
    });
});

app.get('/api/download-update', (req, res) => {
    const isAdmin = req.query.role === 'admin' || req.query.app === 'admin' || req.query.role === 'Administrator';
    const installerName = isAdmin ? 'The Verity Admin Setup.exe' : 'The Verity Setup 1.0.0.exe';
    const installerPath = path.resolve(__dirname, '../dist', installerName);
    if (fs.existsSync(installerPath)) {
        res.download(installerPath, installerName);
    } else {
        res.redirect('https://github.com/belheroth/Verity/releases/latest');
    }
});

app.get('/health', async (req, res) => {
    try {
        await db.get('SELECT 1');
        res.status(200).json({
            status: 'operational',
            uptime: process.uptime(),
            db: 'connected',
            provider: db.providerName,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: err.message,
            uptime: process.uptime(),
            db: 'error',
            provider: db.providerName,
            timestamp: new Date().toISOString()
        });
    }
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

// Socket.IO Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err && user) {
                socket.user = user;
            }
            next();
        });
    } else {
        next();
    }
});

// --- DATABASE HELPERS ---
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- PASSWORD VALIDATION HELPER ---
const validatePassword = async (password) => {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
        if (row && row.value) {
            const config = JSON.parse(row.value);
            const policies = config.passwordPolicies || {};
            if (policies.minLength8 && password.length < 8) return 'Password must be at least 8 characters long.';
            if (policies.numbers && !/\d/.test(password)) return 'Password must contain at least one number.';
            if (policies.specialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character.';
        }
    } catch (_) {}
    return null;
};

// --- MAINTENANCE MODE HELPER ---
const getMaintenanceStatus = async () => {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const config = JSON.parse(row.value);
            if (config.general && config.general.maintenanceMode) {
                return {
                    enabled: true,
                    message: config.general.offlineMessage || 'The system is currently undergoing maintenance. Please try again later.',
                };
            }
        }
    } catch (_) {}
    return { enabled: false, message: '' };
};

// Public endpoint: allows login page to check maintenance status without auth
app.get('/maintenance-status', async (req, res) => {
    const status = await getMaintenanceStatus();
    res.status(200).json(status);
});

// Public endpoint: returns security/kiosk settings for student workspace enforcement
app.get('/kiosk-settings', async (req, res) => {
    const settings = await getKioskSettings();
    res.status(200).json({ settings });
});

// --- AUTHENTICATION ROUTES & OTP VERIFICATION ---

app.post('/auth/send-otp', async (req, res) => {
    try {
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { name, email, password, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const trimmedName = (name || '').trim();

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        const passwordError = await validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // 1. Check if email already exists in users or admin_users
        const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUserEmail || existingAdminEmail) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        // 2. Generate 6-digit cryptographically secure OTP
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

        // 3. Remove any previous unverified OTP records for this email
        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        // 4. Save new OTP record
        const userData = JSON.stringify({
            name: trimmedName,
            email: cleanEmail,
            password,
            role: role === 'Teacher' ? 'Teacher' : 'Student'
        });

        await db.run(
            'INSERT INTO otp_verifications (email, otp_code, user_data, expires_at) VALUES (?, ?, ?, ?)',
            cleanEmail, otpCode, userData, expiresAt
        );

        // 5. Send Email
        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: trimmedName,
            otp: otpCode
        });

        if (!emailResult.success) {
            console.warn(`[AUTH] Email delivery failed or offline for ${cleanEmail} (${emailResult.error}). Operating in Offline ComLab mode.`);
            return res.status(200).json({
                message: `Offline ComLab mode: Verification code is ${otpCode}`,
                email: cleanEmail,
                devOtp: otpCode,
                expiresInMinutes: 15
            });
        }

        res.status(200).json({
            message: 'Verification code sent to your email',
            email: cleanEmail,
            expiresInMinutes: 15
        });
    } catch (e) {
        console.error('Error sending OTP:', e);
        res.status(500).json({ message: e.message || 'Failed to send verification code' });
    }
});

app.post('/auth/verify-otp', async (req, res) => {
    try {
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanOtp = (otp || '').trim();

        // 1. Fetch latest OTP verification record for this email
        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No verification code found for this email. Please request a new one.' });
        }

        const now = Date.now();
        const expiresAt = Number(record.expires_at || record.expiresat || 0);

        if (now > expiresAt) {
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
        }

        if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
            return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
        }

        // 2. Parse stored registration data
        let userData;
        try {
            userData = JSON.parse(record.user_data || record.userdata);
        } catch {
            return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
        }

        const { name, password, role } = userData;

        // Double check email availability
        const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUser || existingAdmin) {
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);
            return res.status(400).json({ message: 'Email is already registered. Please log in.' });
        }

        let userRole = (role === 'Teacher') ? 'Teacher' : 'Student';
        let status = 'Active';

        let requireApproval = true;
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row) {
                const config = JSON.parse(row.value);
                if (config?.roles?.requireAdminApproval === false) {
                    requireApproval = false;
                }
            }
        } catch (e) {}

        if (userRole === 'Teacher') {
            status = !requireApproval ? 'Active' : 'Pending';
        } else {
            status = 'Active';
        }

        const info = await db.run(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
            name, cleanEmail, password, userRole, status
        );

        // Delete used verification record
        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        const user = { id: info.lastInsertRowid, name, email: cleanEmail, password, role: userRole, status };
        const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

        // Emit real-time socket events so admin sees new user/instructor immediately
        try {
            io.emit('users_updated');
            io.emit('admin_security_alert');
            io.emit('admin_stats_update');
        } catch (_) {}

        // Log audit log event
        try {
            const nowIso = new Date().toISOString();
            if (userRole === 'Teacher') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                    status === 'Pending' ? `New instructor account registered and pending admin approval (${cleanEmail})` : `New instructor account registered (${cleanEmail})`
                ).catch(() => {});
            } else {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'User Registration', 'Normal', `New student account registered (${cleanEmail})`
                ).catch(() => {});
            }
        } catch (_) {}

        res.status(201).json({
            message: status === 'Pending' ? 'Account created and pending admin approval.' : 'Account registered and verified successfully.',
            user,
            token: userToken,
            pendingApproval: status === 'Pending'
        });
    } catch (e) {
        console.error('Error verifying OTP:', e);
        res.status(500).json({ message: e.message || 'Verification failed' });
    }
});

app.post('/auth/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const cleanEmail = email.trim().toLowerCase();

        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No registration session found. Please enter your details again.' });
        }

        let userData;
        try {
            userData = JSON.parse(record.user_data || record.userdata);
        } catch {
            return res.status(400).json({ message: 'Invalid registration session. Please enter your details again.' });
        }

        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;

        await db.run(
            'UPDATE otp_verifications SET otp_code = ?, expires_at = ? WHERE id = ?',
            otpCode, expiresAt, record.id
        );

        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: (userData && userData.name) || 'User',
            otp: otpCode
        });

        if (!emailResult.success) {
            console.warn(`[AUTH] Failed to resend email or offline for ${cleanEmail} (${emailResult.error}). Operating in Offline ComLab mode.`);
            return res.status(200).json({
                message: `Offline ComLab mode: Verification code is ${otpCode}`,
                email: cleanEmail,
                devOtp: otpCode,
                expiresInMinutes: 15
            });
        }

        res.status(200).json({ message: 'A new verification code has been sent to your email.' });
    } catch (e) {
        res.status(500).json({ message: e.message || 'Failed to resend code' });
    }
});

app.post('/register', async (req, res) => {
    try {
        // Block registration during maintenance mode (unless requester is admin)
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let isAdmin = false;
            if (token) {
                try { const d = jwt.verify(token, JWT_SECRET); if (d && d.role === 'Admin') isAdmin = true; } catch (_) {}
            }
            if (!isAdmin) {
                return res.status(503).json({ message: maintenance.message, maintenance: true });
            }
        }

        const { name, email, password, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanName = (name || '').trim().toLowerCase();

        const passwordError = await validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // 1. Check if email already exists in users or admin_users
        const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
        const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (existingUserEmail || existingAdminEmail) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        // Check if an existing Admin is creating this account
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let requesterIsAdmin = false;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded && decoded.role === 'Admin') {
                    requesterIsAdmin = true;
                }
            } catch (_) {}
        }

        let userRole = 'Student';
        let status = 'Active';

        let requireApproval = true;
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row) {
                const config = JSON.parse(row.value);
                if (config?.roles?.requireAdminApproval === false) {
                    requireApproval = false;
                }
            }
        } catch (e) {}

        if (requesterIsAdmin && role === 'Admin') {
            userRole = 'Admin';
            status = 'Active';
        } else if (role === 'Teacher') {
            userRole = 'Teacher';
            // If created by an Admin, can be Active immediately; public signup requires admin approval if setting is true
            status = requesterIsAdmin || !requireApproval ? 'Active' : 'Pending';
        } else {
            userRole = 'Student';
            status = 'Active';
        }

        const info = await db.run(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
            name, email, password, userRole, status
        );
        const user = { id: info.lastInsertRowid, name, email, password, role: userRole, status };
        const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

        // Emit real-time socket events so admin sees new user/instructor immediately
        try {
            io.emit('users_updated');
            io.emit('admin_security_alert');
            io.emit('admin_stats_update');
        } catch (_) {}

        // Log audit log event
        try {
            const nowIso = new Date().toISOString();
            if (userRole === 'Teacher') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                    status === 'Pending' ? `New instructor account registered and pending admin approval (${email})` : `New instructor account registered (${email})`
                ).catch(() => {});
            } else if (userRole === 'Student') {
                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso, name, 'User Registration', 'Normal', `New student account registered (${email})`
                ).catch(() => {});
            }
        } catch (_) {}

        res.status(201).json({ message: 'User registered successfully', user, token: userToken });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        // Block student/teacher login during maintenance mode
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        const { email, password } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const rawPassword = password !== undefined ? String(password) : '';
        const cleanPassword = rawPassword.trim();

        // 1. STRICT ISOLATION: Check if admin account attempting standard login
        const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (isAdminAcc) {
            return res.status(401).json({ 
                message: 'This account has Administrator privileges. Please sign in through the Admin Portal (/admin).' 
            });
        }

        // 2. Standard login queries users table (Teachers & Students) ONLY
        // Support matching exact password or trimmed password
        let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ? AND password = ?', cleanEmail, rawPassword);
        if (!user && cleanPassword && cleanPassword !== rawPassword) {
            user = await db.get('SELECT * FROM users WHERE LOWER(email) = ? AND password = ?', cleanEmail, cleanPassword);
        }

        if (!user) {
            const userExists = await db.get('SELECT id, password, role FROM users WHERE LOWER(email) = ?', cleanEmail);
            if (userExists) {
                if (userExists.password === 'google_sso_user') {
                    return res.status(401).json({
                        message: 'This account was registered with Google Sign-In. Please sign in with Google or reset your password.'
                    });
                }
                return res.status(401).json({ message: 'Invalid credentials. Please verify your password.' });
            }
            return res.status(401).json({ message: 'Invalid credentials. No account found with this email address.' });
        }

        if (user.role === 'Admin' || user.role === 'admin') {
            try { await db.run('DELETE FROM users WHERE id = ?', user.id); } catch (_) {}
            return res.status(401).json({ 
                message: 'This account has Administrator privileges. Please sign in through the Admin Portal (/admin).' 
            });
        }
        if (user.status === 'Pending') {
            return res.status(403).json({ message: 'Your account is pending admin approval' });
        }
        user.lastLogin = new Date().toISOString();
        await db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id);
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
        res.status(200).json({ message: 'Login successful', user, token });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ADMIN ISOLATED AUTH & PROFILE ENDPOINTS ---
app.post('/admin/login', adminIpWhitelist, adminLoginRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const adminUser = await db.get('SELECT * FROM admin_users WHERE LOWER(email) = ? AND password = ?', cleanEmail, password);

        if (!adminUser) {
            if (req.adminRateRecord) {
                req.adminRateRecord.count += 1;
                adminLoginAttempts.set(req.clientIp, req.adminRateRecord);
            }
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        if (adminUser.status === 'Suspended') {
            return res.status(403).json({ message: 'Admin account is suspended' });
        }

        // Reset rate limiter on successful login
        if (req.clientIp) adminLoginAttempts.delete(req.clientIp);

        adminUser.lastLogin = new Date().toISOString();
        await db.run('UPDATE admin_users SET lastLogin = ? WHERE id = ?', adminUser.lastLogin, adminUser.id);

        const token = jwt.sign(
            { id: adminUser.id, email: adminUser.email, role: 'Admin', name: adminUser.name, isAdmin: true },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const adminObj = {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            role: 'Admin',
            status: adminUser.status || 'Active',
            lastLogin: adminUser.lastLogin,
            avatar: adminUser.avatar || null
        };

        res.status(200).json({ message: 'Admin login successful', user: adminObj, token });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/admin/profile', authenticateToken, adminIpWhitelist, requireRole('Admin'), async (req, res) => {
    try {
        const adminUser = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE id = ?', req.user.id);
        if (!adminUser) return res.status(404).json({ message: 'Admin profile not found' });
        res.status(200).json({ user: adminUser });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // We will dynamically set redirect URI per request, but define a fallback
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
);

app.get('/auth/google/external', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).send('Missing sessionId');
    }
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;
    const authorizeUrl = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        state: sessionId,
        redirect_uri: redirectUri
    });
    res.redirect(authorizeUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, state: sessionId } = req.query;
    if (!code || !sessionId) {
        return res.status(400).send('Missing code or state');
    }

    try {
        const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;
        const { tokens } = await googleClient.getToken({
            code,
            redirect_uri: redirectUri
        });

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const cleanEmail = (email || '').trim().toLowerCase();

        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            io.emit(`google-login-error-${sessionId}`, { message: maintenance.message });
            return res.send(`<h2>System Maintenance</h2><p>${maintenance.message}</p>`);
        }

        const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (isAdminAcc) {
            io.emit(`google-login-error-${sessionId}`, { message: 'Invalid credentials' });
            return res.send(`<h2>Error</h2><p>Cannot login with admin account here.</p>`);
        }

        let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);

        if (user) {
            if (user.status === 'Pending') {
                io.emit(`google-login-error-${sessionId}`, { message: 'Your account is pending admin approval' });
                return res.send('<h2>Account Pending</h2><p>Your account is pending admin approval.</p>');
            }
            user.lastLogin = new Date().toISOString();
            await db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id);
        } else {
            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) requireApproval = false;
                }
            } catch (e) {}

            // Default to Student for new external SSO signups unless we know they chose Teacher (not possible via basic GET)
            const role = 'Student';
            const status = 'Active';
            const lastLogin = new Date().toISOString();
            const password = 'google_sso_user';

            const info = await db.run(
                'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                name, cleanEmail, password, role, lastLogin, status
            );
            user = { id: info.lastInsertRowid, name, email: cleanEmail, password, role, status, lastLogin };
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
        
        io.emit(`google-login-success-${sessionId}`, { user, token });

        res.send(`
            <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white;">
                    <div style="text-align: center;">
                        <h2 style="color: #10b981;">Authentication Successful!</h2>
                        <p>You can safely close this window and return to The Verity app.</p>
                        <script>
                            setTimeout(() => window.close(), 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        console.error('Google OAuth Callback Error:', err);
        io.emit(`google-login-error-${sessionId}`, { message: 'Google authentication failed' });
        res.status(500).send('<h2>Authentication Failed</h2><p>An error occurred during Google sign-in. Please try again.</p>');
    }
});

app.post('/auth/google', async (req, res) => {
    const { token, access_token, role: userRole } = req.body;
    try {
        // Block Google SSO login during maintenance mode
        const maintenance = await getMaintenanceStatus();
        if (maintenance.enabled) {
            return res.status(503).json({ message: maintenance.message, maintenance: true });
        }

        let email, name;

        if (access_token) {
            // useGoogleLogin implicit flow: verify via Google userinfo endpoint
            const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
            if (!userInfoRes.ok) {
                return res.status(401).json({ message: 'Invalid Google token' });
            }
            const userInfo = await userInfoRes.json();
            email = userInfo.email;
            name = userInfo.name;
        } else {
            // Legacy: GoogleLogin component sends credential (ID token)
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID || '6514928694-2rd8cu7b67o4f2jqtuv5hk1d51s97lcc.apps.googleusercontent.com'
            });
            const payload = ticket.getPayload();
            email = payload.email;
            name = payload.name;
        }

        const cleanEmail = (email || '').trim().toLowerCase();

        const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
        if (isAdminAcc) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);

        if (user) {
            if (user.status === 'Pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval' });
            }
            user.lastLogin = new Date().toISOString();
            await db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id);
        } else {
            // Self-registration via Google OAuth: only Teacher or Student allowed (never Admin)
            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) {
                        requireApproval = false;
                    }
                }
            } catch (e) {}

            const role = (userRole === 'Teacher') ? 'Teacher' : 'Student';
            const status = (role === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
            const lastLogin = new Date().toISOString();
            const password = 'google_sso_user';

            const info = await db.run(
                'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                name, email, password, role, lastLogin, status
            );
            user = { id: info.lastInsertRowid, name, email, password, role, lastLogin, status };

            if (status === 'Pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval', user });
            }
        }

        res.status(200).json({ message: 'Google login successful', user, token: jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET) });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ message: 'Invalid Google token' });
    }
});

// --- ADMIN: USER MANAGEMENT ---
app.get('/users', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, email, role, lastLogin, status FROM users ORDER BY id ASC');

        let recentLogs = [];
        try {
            recentLogs = await db.all('SELECT id, "user", timestamp, "desc" FROM audit_logs ORDER BY id DESC LIMIT 500');
        } catch (_) {}

        const userFlagsMap = new Map();
        for (const log of recentLogs) {
            const rawUser = String(log.user || log['user'] || '').trim().toLowerCase();
            if (!rawUser) continue;
            let entry = userFlagsMap.get(rawUser);
            if (!entry) {
                entry = { lastFlagTime: log.timestamp, lastFlagDesc: log.desc, count: 0 };
                userFlagsMap.set(rawUser, entry);
            }
            entry.count++;
        }

        const formattedUsers = users.map(u => {
            const nameLower = (u.name || '').trim().toLowerCase();
            const emailLower = (u.email || '').trim().toLowerCase();
            const flagInfo = userFlagsMap.get(nameLower) || userFlagsMap.get(emailLower) || null;
            return {
                ...u,
                status: u.status || 'Active',
                lastLogin: u.lastLogin || u.lastlogin || null,
                lastFlagTime: flagInfo?.lastFlagTime || null,
                lastFlagDesc: flagInfo?.lastFlagDesc || null,
                flagCount: Number(flagInfo?.count || 0)
            };
        });

        res.status(200).json({ users: formattedUsers });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- USER PROFILE ENDPOINTS ---
app.get('/users/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let user = await db.get('SELECT id, name, email, role, avatar, status FROM users WHERE id = ?', userId);
        if (!user && req.user.role === 'Admin') {
            user = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE id = ?', userId);
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/profile', authenticateToken, async (req, res) => {
    try {
        const { name, avatar } = req.body || {};
        const userId = req.user.id;
        let current = await db.get('SELECT * FROM users WHERE id = ?', userId);
        let isAdmin = false;
        if (!current && req.user.role === 'Admin') {
            current = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
            isAdmin = true;
        }
        if (!current) return res.status(404).json({ message: 'User not found' });

        const updatedName = name && name.trim() ? name.trim() : current.name;
        // Never overwrite email from generic profile updates — email is strictly protected by OTP verification
        const updatedEmail = current.email;
        const updatedAvatar = avatar !== undefined ? avatar : current.avatar;

        if (isAdmin) {
            await db.run(
                'UPDATE admin_users SET name = ?, avatar = ? WHERE id = ?',
                updatedName, updatedAvatar, userId
            );
        } else {
            await db.run(
                'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
                updatedName, updatedAvatar, userId
            );

            // If teacher, keep their classrooms updated with their real name
            if (current.role === 'Teacher') {
                await db.run(
                    'UPDATE classrooms SET instructor = ? WHERE LOWER(instructor_email) = LOWER(?) OR instructor = ?',
                    updatedName, current.email, current.name
                ).catch(() => {});
            }
        }

        const user = {
            id: userId,
            name: updatedName,
            email: updatedEmail,
            role: current.role,
            avatar: updatedAvatar,
            status: current.status
        };

        // Broadcast avatar update so others and all active sessions update in real time
        io.emit('user_avatar_updated', {
            userId,
            name: updatedName,
            email: updatedEmail,
            avatar: updatedAvatar,
            role: current.role
        });

        if (current.role === 'Teacher') {
            io.emit('classrooms_updated');
        }

        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/users/:email', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const email = decodeURIComponent(req.params.email);
        const info = await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?)', email);
        if (info.changes === 0) return res.status(404).json({ message: 'User not found' });
        try {
            io.emit('users_updated');
            io.emit('admin_stats_update');
        } catch (_) {}
        res.status(200).json({ message: 'User deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/:email/status', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const email = decodeURIComponent(req.params.email);
        const { status } = req.body;
        const info = await db.run('UPDATE users SET status = ? WHERE LOWER(email) = LOWER(?)', status, email);
        if (info.changes === 0) return res.status(404).json({ message: 'User not found' });
        try {
            io.emit('users_updated');
            io.emit('admin_stats_update');
        } catch (_) {}
        res.status(200).json({ message: 'User status updated' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/users/:email', authenticateToken, requireRole('Admin'), async (req, res, next) => {
    if (req.params.email === 'profile') return next();
    try {
        const targetEmail = decodeURIComponent(req.params.email).toLowerCase();
        const { name, email, role, status, password } = req.body || {};

        const existing = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', targetEmail);
        if (!existing) return res.status(404).json({ message: 'User not found' });

        const newName = name && name.trim() ? name.trim() : existing.name;
        const newEmail = email && email.trim() ? email.trim().toLowerCase() : existing.email;
        const newRole = role || existing.role;
        const newStatus = status || existing.status || 'Active';

        if (newEmail !== existing.email.toLowerCase()) {
            const conflict = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', newEmail, existing.id);
            if (conflict) return res.status(400).json({ message: 'Email is already in use by another user' });
        }

        if (password && password.trim()) {
            const passwordError = await validatePassword(password.trim());
            if (passwordError) return res.status(400).json({ message: passwordError });

            await db.run(
                'UPDATE users SET name = ?, email = ?, role = ?, status = ?, password = ? WHERE id = ?',
                newName, newEmail, newRole, newStatus, password.trim(), existing.id
            );
        } else {
            await db.run(
                'UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?',
                newName, newEmail, newRole, newStatus, existing.id
            );
        }

        await syncUserEmailAcrossData(existing.id, existing.email, newEmail, newName, newRole);

        const updatedUser = await db.get('SELECT id, name, email, role, status, lastLogin FROM users WHERE id = ?', existing.id);
        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Helper to synchronize email changes across classrooms and enrollments safely
async function syncUserEmailAcrossData(userId, oldEmail, newEmail, name, role) {
    if (!userId || !newEmail) return;
    const cleanOldEmail = (oldEmail || '').trim().toLowerCase();
    const cleanNewEmail = newEmail.trim().toLowerCase();
    const cleanName = (name || '').trim();
    const roleLower = String(role || '').toLowerCase();
    const isTeacher = roleLower === 'teacher' || roleLower === 'instructor';

    // 1. Keep student enrollments in sync safely without unique constraint collision
    try {
        const oldEnrollments = await db.all(
            `SELECT * FROM enrollments 
             WHERE (student_email IS NOT NULL AND LOWER(student_email) = ?)
                OR (student_id IS NOT NULL AND (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)))`,
            cleanOldEmail, userId, String(userId)
        ).catch(() => []);

        for (const en of (oldEnrollments || [])) {
            const conflict = await db.get(
                'SELECT id FROM enrollments WHERE classroom_id = ? AND LOWER(student_email) = LOWER(?) AND id != ?',
                en.classroom_id, cleanNewEmail, en.id
            ).catch(() => null);

            if (conflict) {
                await db.run(
                    'UPDATE enrollments SET student_id = ?, student_name = COALESCE(NULLIF(student_name, \'\'), ?) WHERE id = ?',
                    userId, cleanName, conflict.id
                ).catch(() => {});
                await db.run('DELETE FROM enrollments WHERE id = ?', en.id).catch(() => {});
            } else {
                await db.run(
                    'UPDATE enrollments SET student_email = ?, student_id = ?, student_name = COALESCE(NULLIF(student_name, \'\'), ?) WHERE id = ?',
                    cleanNewEmail, userId, cleanName, en.id
                ).catch(() => {});
            }
        }
    } catch (e) {
        console.error('[syncUserEmailAcrossData] Error updating enrollments:', e);
    }

    // 2. Keep teacher classrooms in sync so the teacher retains all their classes
    if (isTeacher || cleanName) {
        try {
            await db.run(
                `UPDATE classrooms SET 
                    instructor_email = ?, 
                    instructor = COALESCE(NULLIF(instructor, ''), ?) 
                 WHERE (instructor_email IS NOT NULL AND LOWER(instructor_email) = ?) 
                    OR (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = TRIM(LOWER(?)))`,
                cleanNewEmail, cleanName, cleanOldEmail, cleanName
            ).catch(() => {});
        } catch (e) {
            console.error('[syncUserEmailAcrossData] Error updating teacher classrooms:', e);
        }
    }

    // 3. Emit real-time updates so open student and teacher views refresh immediately
    try {
        io.emit('classrooms_updated');
        io.emit('classroom_students_changed', {});
    } catch (_) {}
}

// --- CHANGE EMAIL VERIFICATION OTP ENDPOINTS ---
app.post('/users/send-email-change-otp', authenticateToken, async (req, res) => {
    try {
        const { newEmail } = req.body || {};
        if (!newEmail || !newEmail.trim()) {
            return res.status(400).json({ message: 'New email address is required' });
        }
        const cleanEmail = newEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        const currentEmail = (req.user.email || '').trim().toLowerCase();
        if (cleanEmail === currentEmail) {
            return res.status(400).json({ message: 'New email must be different from your current email' });
        }

        // Check if email is already in use by someone else
        const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
        const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
        if (existingUser || existingAdmin) {
            return res.status(400).json({ message: 'This email is already in use by another account' });
        }

        // Generate 6-digit OTP
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;

        await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

        const sessionData = JSON.stringify({
            userId: req.user.id,
            currentEmail: req.user.email,
            newEmail: cleanEmail,
            action: 'change_email'
        });

        await db.run(
            'INSERT INTO otp_verifications (email, otp_code, user_data, expires_at) VALUES (?, ?, ?, ?)',
            cleanEmail, otpCode, sessionData, expiresAt
        );

        const emailResult = await sendOtpEmail({
            email: cleanEmail,
            name: req.user.name || 'User',
            otp: otpCode
        });

        if (!emailResult.success) {
            console.error(`[AUTH] Failed to send email change OTP to ${cleanEmail}:`, emailResult.error);
            if (emailResult.simulated) {
                return res.status(200).json({
                    message: `SMTP not configured on server. Dev verification code: ${otpCode}`,
                    email: cleanEmail,
                    devOtp: otpCode,
                    expiresInMinutes: 15
                });
            }
            return res.status(500).json({
                message: `Failed to deliver verification email: ${emailResult.error || 'Delivery failed'}.`
            });
        }

        res.status(200).json({
            message: `Verification code sent to ${cleanEmail}`,
            email: cleanEmail,
            expiresInMinutes: 15
        });
    } catch (e) {
        console.error('Error sending email change OTP:', e);
        res.status(500).json({ message: e.message || 'Failed to send verification code' });
    }
});

app.post('/users/verify-email-change', authenticateToken, async (req, res) => {
    try {
        const { newEmail, otp, newPassword } = req.body || {};
        if (!newEmail || !otp) {
            return res.status(400).json({ message: 'New email and verification code are required' });
        }
        const cleanEmail = newEmail.trim().toLowerCase();
        const cleanOtp = String(otp).trim();

        const record = await db.get(
            'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
            cleanEmail
        );

        if (!record) {
            return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
        }

        const now = Date.now();
        const expiresAt = Number(record.expires_at || record.expiresat || 0);
        if (now > expiresAt) {
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            return res.status(400).json({ message: 'This verification code has expired. Please request a new one.' });
        }

        if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
            return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
        }

        const userId = req.user.id;
        const current = await db.get('SELECT * FROM users WHERE id = ?', userId);
        if (!current) {
            const adminCurrent = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
            if (!adminCurrent) return res.status(404).json({ message: 'User account not found' });
            
            await db.run('UPDATE admin_users SET email = ? WHERE id = ?', cleanEmail, userId);
            if (newPassword && newPassword.trim()) {
                await db.run('UPDATE admin_users SET password = ? WHERE id = ?', newPassword.trim(), userId);
            }
            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            const updatedUser = { ...adminCurrent, email: cleanEmail };
            const token = jwt.sign(
                { id: updatedUser.id, email: cleanEmail, role: 'Admin', name: updatedUser.name, isAdmin: true },
                JWT_SECRET
            );
            return res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
        }

        await db.run('UPDATE users SET email = ? WHERE id = ?', cleanEmail, userId);

        if (newPassword && newPassword.trim()) {
            await db.run('UPDATE users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        }

        // Keep student enrollments and teacher classrooms in sync so classrooms remain intact
        await syncUserEmailAcrossData(userId, current.email, cleanEmail, current.name, current.role);

        if (current.role === 'Admin') {
            await db.run('UPDATE admin_users SET email = ? WHERE id = ?', cleanEmail, userId).catch(() => {});
        }

        await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);

        const updatedUser = {
            id: current.id,
            name: current.name,
            email: cleanEmail,
            role: current.role,
            avatar: current.avatar,
            status: current.status
        };

        const token = jwt.sign(
            { id: updatedUser.id, email: cleanEmail, role: updatedUser.role, name: updatedUser.name },
            JWT_SECRET
        );

        io.emit('user_avatar_updated', {
            userId: updatedUser.id,
            name: updatedUser.name,
            email: cleanEmail,
            avatar: updatedUser.avatar,
            role: updatedUser.role
        });

        res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
    } catch (e) {
        console.error('Error verifying email change:', e);
        res.status(500).json({ message: e.message || 'Failed to update email' });
    }
});

// --- CHANGE PASSWORD ENDPOINT ---
app.post('/users/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!newPassword || !newPassword.trim()) {
            return res.status(400).json({ message: 'New password is required' });
        }

        const userId = req.user.id;
        let user = await db.get('SELECT * FROM users WHERE id = ?', userId);
        let isAdmin = false;
        if (!user && req.user.role === 'Admin') {
            user = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
            isAdmin = true;
        }

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        // For Google SSO users without an existing manual password, allow setting initial password without currentPassword
        const isGoogleSso = user.password === 'google_sso_user';
        if (!isGoogleSso) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required' });
            }
            if (user.password !== currentPassword && user.password !== currentPassword.trim()) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
            if (currentPassword.trim() === newPassword.trim()) {
                return res.status(400).json({ message: 'New password must be different from your current password' });
            }
        }

        const passwordError = await validatePassword(newPassword.trim());
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        if (isAdmin) {
            await db.run('UPDATE admin_users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        } else {
            await db.run('UPDATE users SET password = ? WHERE id = ?', newPassword.trim(), userId);
        }

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (e) {
        console.error('Error changing password:', e);
        res.status(500).json({ message: e.message || 'Failed to update password' });
    }
});

// --- CLASSWORK PERSISTENCE HELPERS ---
const getClassworkFromDb = async (classroomId) => {
    const rows = (classroomId && classroomId !== 'all')
        ? await db.all('SELECT * FROM classwork WHERE classroom_id = ? ORDER BY id DESC', classroomId)
        : await db.all('SELECT * FROM classwork ORDER BY id DESC');
    return rows.map(row => {
        let meta = {};
        if (row.description) {
            try {
                meta = JSON.parse(row.description);
            } catch (e) {
                meta = { details: row.description };
            }
        }
        return {
            id: row.id,
            classroom_id: row.classroom_id,
            title: row.title,
            dueDate: row.dueDate || '',
            type: row.type || '',
            activityType: meta.activityType || row.type || 'Assignment',
            details: meta.details !== undefined ? meta.details : (row.description || ''),
            attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
            points: meta.points !== undefined ? meta.points : '100',
            grading: meta.grading !== undefined ? meta.grading : 'On',
            archived: typeof meta.archived === 'boolean' ? meta.archived : false,
            posted: meta.posted || row.created_at,
            testCases: Array.isArray(meta.testCases) ? meta.testCases : []
        };
    });
};

const saveClassworkToDb = async (classroomId, classwork) => {
    if (classroomId == null || !Array.isArray(classwork)) return;

    const currentIds = classwork.map(cw => Number(cw.id)).filter(id => !isNaN(id));

    // Handle deletions safely without violating foreign key constraints
    if (currentIds.length > 0) {
        const placeholders = currentIds.map(() => '?').join(',');
        const toDelete = await db.all(`
            SELECT id FROM classwork 
            WHERE classroom_id = ? AND id NOT IN (${placeholders})
        `, classroomId, ...currentIds);

        for (const item of toDelete) {
            try {
                await db.run('DELETE FROM classwork WHERE id = ?', item.id);
            } catch (e) {
                // Has submissions referencing it; archive instead of hard delete
                const currentItem = await db.get('SELECT description FROM classwork WHERE id = ?', item.id);
                let meta = {};
                try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                meta.archived = true;
                await db.run('UPDATE classwork SET description = ? WHERE id = ?', JSON.stringify(meta), item.id);
            }
        }
    }

    // Upsert all items with full metadata preserved as JSON in description
    for (const cw of classwork) {
        const id = Number(cw.id) || Date.now();
        const descObj = {
            details: cw.details !== undefined ? cw.details : (cw.description || ''),
            attachments: Array.isArray(cw.attachments) ? cw.attachments : [],
            points: cw.points !== undefined ? cw.points : '100',
            grading: cw.grading !== undefined ? cw.grading : 'On',
            archived: !!cw.archived,
            posted: cw.posted || null,
            testCases: Array.isArray(cw.testCases) ? cw.testCases : [],
            activityType: cw.activityType || cw.type || 'Assignment'
        };
        await db.run(`
            INSERT INTO classwork (id, classroom_id, title, description, dueDate, type)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                classroom_id = excluded.classroom_id,
                title = excluded.title,
                description = excluded.description,
                dueDate = excluded.dueDate,
                type = excluded.type
        `, id, Number(classroomId) || classroomId, cw.title || '', JSON.stringify(descObj), cw.dueDate || '', cw.type || cw.activityType || '');
    }
};

// --- ACCESS CONTROL HELPERS ---
async function checkClassroomAccess(req, classroomId) {
    const roleLower = String(req.user?.role || '').toLowerCase();
    if (roleLower === 'admin') return true;
    if (roleLower === 'teacher' || roleLower === 'instructor') {
        const c = await db.get('SELECT instructor_email, instructor FROM classrooms WHERE id = ?', classroomId);
        if (!c) return false;
        const teacherEmail = (req.user.email || '').trim().toLowerCase();
        const teacherName = (req.user.name || '').trim().toLowerCase();
        const cEmail = (c.instructor_email || '').trim().toLowerCase();
        const cName = (c.instructor || '').trim().toLowerCase();
        const matchesEmail = Boolean(teacherEmail && cEmail && cEmail === teacherEmail);
        const matchesName = Boolean(teacherName && cName && cName === teacherName);
        if (matchesEmail || matchesName) {
            // Self-heal: keep instructor_email up-to-date
            if (teacherEmail && cEmail !== teacherEmail && matchesName) {
                db.run('UPDATE classrooms SET instructor_email = ? WHERE id = ?', teacherEmail, classroomId).catch(() => {});
            }
            return true;
        }
        return false;
    }
    if (roleLower === 'student') {
        const studentEmail = (req.user.email || '').trim().toLowerCase();
        const studentName = (req.user.name || '').trim().toLowerCase();
        const studentId = req.user.id || 0;
        const e = await db.get(
            `SELECT 1 FROM enrollments 
             WHERE (classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT))
               AND ((student_email IS NOT NULL AND LOWER(student_email) = ?) 
                 OR (student_id IS NOT NULL AND (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)))
                 OR (student_name IS NOT NULL AND LOWER(student_name) = ?))`,
            classroomId, String(classroomId), studentEmail, studentId, String(studentId), studentName
        );
        return !!e;
    }
    return false;
}

async function checkAssignmentAccess(req, assignmentId) {
    const roleLower = String(req.user?.role || '').toLowerCase();
    if (roleLower === 'admin') return true;
    const numId = Number(assignmentId);
    let cw = null;
    if (!isNaN(numId) && numId > 0) {
        cw = await db.get('SELECT classroom_id FROM classwork WHERE id = ?', numId);
    }
    if (!cw) {
        cw = await db.get('SELECT classroom_id FROM classwork WHERE CAST(id AS TEXT) = ?', String(assignmentId));
    }
    if (!cw) return false;
    return checkClassroomAccess(req, cw.classroom_id);
}

// --- CLASSWORK PERSISTENCE ENDPOINTS ---
app.get('/classwork', authenticateToken, async (req, res) => {
    try {
        const classwork = await getClassworkFromDb();
        if (req.user?.role === 'Admin') {
            return res.status(200).json({ classwork });
        }
        const filtered = [];
        for (const cw of classwork) {
            if (await checkClassroomAccess(req, cw.classroom_id)) {
                filtered.push(cw);
            }
        }
        res.status(200).json({ classwork: filtered });
    } catch (e) {
        console.error('Error fetching all classwork:', e);
        res.status(500).json({ classwork: [] });
    }
});

app.get('/classwork/:classroomId', authenticateToken, async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const classwork = await getClassworkFromDb(req.params.classroomId);
        res.status(200).json({ classwork });
    } catch (e) {
        console.error('Error fetching classwork:', e);
        res.status(500).json({ classwork: [] });
    }
});

app.put('/classwork/:classroomId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    const { classroomId } = req.params;
    if (!(await checkClassroomAccess(req, classroomId))) {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { classwork } = req.body;
    if (!Array.isArray(classwork)) return res.status(400).json({ message: 'classwork must be an array' });

    try {
        await saveClassworkToDb(classroomId, classwork);
        const updatedClasswork = await getClassworkFromDb(classroomId);
        io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        res.status(200).json({ message: 'Classwork saved', classwork: updatedClasswork });
    } catch (e) {
        console.error('Error saving classwork via PUT:', e);
        res.status(500).json({ message: 'Failed to save classwork' });
    }
});

// --- ANNOUNCEMENTS ---
app.get('/classrooms/:classroomId/announcements', authenticateToken, async (req, res) => {
    try {
        const { classroomId } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const rows = await db.all('SELECT * FROM announcements WHERE classroom_id = ? ORDER BY posted DESC, id DESC', classroomId).catch(() => []);
        const announcements = (rows || []).map(r => ({
            id: Number(r.id),
            classroomId: Number(r.classroom_id || classroomId),
            title: r.title || 'Instructor Announcement',
            details: r.details || '',
            author: r.author || 'Instructor',
            posted: Number(r.posted || (r.created_at ? new Date(r.created_at).getTime() : Date.now()))
        }));
        res.status(200).json({ announcements });
    } catch (e) {
        console.error('Error fetching announcements:', e);
        res.status(500).json({ announcements: [], error: e.message });
    }
});

app.post('/classrooms/:classroomId/announcements', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { classroomId } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { title, details, author, posted, id } = req.body;
        if (!details || !details.trim()) {
            return res.status(400).json({ message: 'Announcement details are required' });
        }
        const announcementId = id ? Number(id) : Date.now();
        const announcementAuthor = author || req.user.name || 'Instructor';
        const postedTime = posted ? Number(posted) : Date.now();
        const announcementTitle = title || 'Instructor Announcement';

        await db.run(`
            INSERT INTO announcements (id, classroom_id, title, details, author, posted)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                details = excluded.details,
                author = excluded.author,
                posted = excluded.posted
        `, announcementId, Number(classroomId), announcementTitle, details.trim(), announcementAuthor, postedTime);

        const newAnnouncement = {
            id: announcementId,
            classroomId: Number(classroomId),
            title: announcementTitle,
            details: details.trim(),
            author: announcementAuthor,
            posted: postedTime
        };

        io.emit('announcement_posted', { classroomId: Number(classroomId), announcement: newAnnouncement });
        res.status(201).json({ announcement: newAnnouncement });
    } catch (e) {
        console.error('Error posting announcement:', e);
        res.status(500).json({ message: 'Failed to post announcement', error: e.message });
    }
});

app.delete('/classrooms/:classroomId/announcements/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { classroomId, id } = req.params;
        if (!(await checkClassroomAccess(req, classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        await db.run('DELETE FROM announcements WHERE id = ? AND classroom_id = ?', Number(id), Number(classroomId));
        io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(id) });
        res.status(200).json({ success: true, message: 'Announcement deleted' });
    } catch (e) {
        console.error('Error deleting announcement:', e);
        res.status(500).json({ message: 'Failed to delete announcement', error: e.message });
    }
});

// --- CLASSROOMS ---
app.get('/classrooms', authenticateToken, async (req, res) => {
    try {
        let rawClassrooms = [];
        const roleLower = String(req.user?.role || '').toLowerCase();
        if (roleLower === 'student') {
            const studentEmail = (req.user.email || '').trim().toLowerCase();
            const studentId = req.user.id || 0;
            rawClassrooms = await db.all(`
                SELECT DISTINCT c.* FROM classrooms c
                INNER JOIN enrollments e ON e.classroom_id = c.id
                WHERE (e.student_email IS NOT NULL AND LOWER(e.student_email) = ?)
                   OR (e.student_id IS NOT NULL AND (e.student_id = ? OR CAST(e.student_id AS TEXT) = CAST(? AS TEXT)))
                ORDER BY LOWER(c.name) ASC, c.id ASC
            `, studentEmail, studentId, String(studentId));

            // Self-heal enrollments: if any enrollment has student_id matching this user, sync student_email
            if (studentEmail && studentId) {
                db.run(
                    'UPDATE enrollments SET student_email = ? WHERE (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)) AND LOWER(student_email) != ?',
                    studentEmail, studentId, String(studentId), studentEmail
                ).catch(() => {});
            }
        } else if (roleLower === 'teacher' || roleLower === 'instructor') {
            const teacherEmail = (req.user.email || '').trim().toLowerCase();
            const teacherName = (req.user.name || '').trim().toLowerCase();
            rawClassrooms = await db.all(`
                SELECT * FROM classrooms
                WHERE (instructor_email IS NOT NULL AND instructor_email != '' AND LOWER(instructor_email) = ?)
                   OR (instructor IS NOT NULL AND instructor != '' AND TRIM(LOWER(instructor)) = ?)
                ORDER BY LOWER(name) ASC, id ASC
            `, teacherEmail, teacherName);

            // Self-heal classrooms: if matched by teacher name but instructor_email is missing or outdated, update it
            if (teacherEmail && teacherName) {
                db.run(
                    'UPDATE classrooms SET instructor_email = ? WHERE (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = ?) AND (instructor_email IS NULL OR instructor_email = \'\' OR LOWER(instructor_email) != ?)',
                    teacherEmail, teacherName, teacherEmail
                ).catch(() => {});
            }
        } else {
            // Admin can view all classrooms
            rawClassrooms = await db.all('SELECT * FROM classrooms ORDER BY LOWER(name) ASC, id ASC');
        }

        // Filter out phantom/dummy classrooms with no valid section/subject
        const validClassrooms = rawClassrooms.filter(c => {
            if (!c || !c.name) return false;
            const isPhantom = /^Classroom \d+$/i.test(c.name.trim()) && (!c.section || !c.section.trim()) && (!c.subject || !c.subject.trim());
            return !isPhantom;
        });

        const formatted = await Promise.all(validClassrooms.map(async c => {
            let instName = (c.instructor && c.instructor.trim()) || '';
            let instEmail = (c.instructor_email && c.instructor_email.trim()) || (c.instructorEmail && c.instructorEmail.trim()) || '';

            let realTeacher = null;
            if (instEmail) {
                realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instEmail).catch(() => null);
                if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", instEmail).catch(() => null);
            }
            if (!realTeacher && instName && instName !== 'Instructor') {
                realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instName).catch(() => null);
                if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", instName).catch(() => null);
            }

            if (realTeacher) {
                instName = realTeacher.name;
                instEmail = realTeacher.email;
            }

            let parsedTheme = null;
            if (c.theme) {
                try {
                    parsedTheme = typeof c.theme === 'string' ? JSON.parse(c.theme) : c.theme;
                } catch {
                    parsedTheme = null;
                }
            }

            return {
                ...c,
                theme: parsedTheme,
                instructor: instName || 'Instructor',
                instructorEmail: instEmail,
                instructorAvatar: realTeacher?.avatar || null
            };
        }));

        // Strictly sort classrooms alphabetically by name
        formatted.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));

        res.status(200).json({ classrooms: formatted });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.put('/classrooms', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    const { classrooms } = req.body;
    if (!Array.isArray(classrooms)) return res.status(400).json({ message: 'classrooms must be an array' });

    try {
        const assignedInBatch = new Set();
        const savedClassrooms = [];

        for (const c of classrooms) {
            if (c.id) {
                const existing = await db.get('SELECT id FROM classrooms WHERE id = ?', c.id);
                if (existing && !(await checkClassroomAccess(req, c.id))) continue;
            }
            // Ignore phantom classrooms
            if (c.name && /^Classroom \d+$/i.test(c.name.trim()) && (!c.section || !c.section.trim()) && (!c.subject || !c.subject.trim())) {
                continue;
            }
            const instName = c.instructor || req.user.name || 'Instructor';
            const instEmail = c.instructorEmail || c.instructor_email || (req.user.role === 'Teacher' ? req.user.email : '');
            const themeStr = c.theme ? (typeof c.theme === 'object' ? JSON.stringify(c.theme) : c.theme) : null;
            const classroomId = c.id || Date.now();

            // Auto-generate or validate unique class code
            let classCode = (c.code || '').toString().trim().toLowerCase();

            // If no code provided in payload, check if this classroom already has one in DB
            if (!classCode) {
                const existingDbClassroom = await db.get('SELECT id, code FROM classrooms WHERE id = ?', classroomId);
                if (existingDbClassroom?.code) {
                    classCode = existingDbClassroom.code.trim().toLowerCase();
                }
            }

            // Check if code is already taken by another classroom or already assigned in this batch
            let codeConflict = false;
            if (classCode) {
                if (assignedInBatch.has(classCode)) {
                    codeConflict = true;
                } else {
                    const row = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                    if (row) codeConflict = true;
                }
            }

            // If empty or conflicted, generate a guaranteed unique code
            if (!classCode || codeConflict) {
                let attempts = 0;
                do {
                    classCode = db.generateClassCodeSync ? db.generateClassCodeSync(assignedInBatch) : ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
                    const conflict = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                    if (!conflict) break;
                    attempts++;
                } while (attempts < 50);
            }

            assignedInBatch.add(classCode);

            await db.run(`
                INSERT INTO classrooms (id, code, section, name, subject, instructor, instructor_email, theme) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    code = excluded.code,
                    section = excluded.section,
                    name = excluded.name,
                    subject = excluded.subject,
                    instructor = excluded.instructor,
                    instructor_email = excluded.instructor_email,
                    theme = COALESCE(excluded.theme, classrooms.theme)
            `,
                classroomId, classCode, c.section || '', c.name || '', c.subject || '', instName, instEmail, themeStr
            );

            savedClassrooms.push({
                ...c,
                id: classroomId,
                code: classCode,
                instructor: instName,
                instructorEmail: instEmail
            });
        }
        res.status(200).json({ message: 'Classrooms saved', classrooms: savedClassrooms });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.patch('/classrooms/:id/theme', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(await checkClassroomAccess(req, id))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { theme } = req.body;
        if (!theme) return res.status(400).json({ message: 'Theme is required' });

        const themeStr = typeof theme === 'object' ? JSON.stringify(theme) : theme;
        await db.run('UPDATE classrooms SET theme = ? WHERE id = ?', themeStr, id);

        const classroom = await db.get('SELECT * FROM classrooms WHERE id = ?', id);
        const detailPayload = {
            classroomId: id,
            code: classroom?.code || classroom?.section,
            name: classroom?.name,
            theme: typeof theme === 'string' ? JSON.parse(theme) : theme
        };

        io.emit('classroom_theme_changed', detailPayload);
        res.status(200).json({ message: 'Theme updated successfully', theme: detailPayload.theme });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/classrooms/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.id))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (req.user.role === 'Teacher') {
            let allowDelete = false;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.allowDeleteCourses === true) {
                        allowDelete = true;
                    }
                }
            } catch (e) {}
            if (!allowDelete) {
                return res.status(403).json({ message: 'Only System Admins can delete courses according to system settings.' });
            }
        }

        const id = req.params.id;
        await db.run('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => {});
        await db.run('DELETE FROM grades WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => {});
        await db.run('DELETE FROM classwork WHERE classroom_id = ?', id).catch(() => {});
        await db.run('DELETE FROM enrollments WHERE classroom_id = ?', id).catch(() => {});
        await db.run('DELETE FROM classrooms WHERE id = ?', id);
        res.status(200).json({ message: 'Classroom deleted successfully' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- SUBMISSIONS ---
app.get('/student/submissions', authenticateToken, requireRole('Student'), async (req, res) => {
    try {
        const rows = await db.all(
            'SELECT assignment_id FROM submissions WHERE student_name = ? OR student_name = ? OR LOWER(student_name) = LOWER(?) OR LOWER(student_name) = LOWER(?)',
            req.user.name || '', req.user.email || '', req.user.name || '', req.user.email || ''
        );
        res.status(200).json({ submissions: rows });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});
app.get('/submissions/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        let rows;
        if (req.user.role === 'Student') {
            // Students are strictly scoped to only view their own submission (fixes IDOR)
            rows = await db.all(
                'SELECT * FROM submissions WHERE assignment_id = ? AND (student_name = ? OR student_name = ? OR LOWER(student_name) = LOWER(?) OR LOWER(student_name) = LOWER(?))',
                req.params.assignmentId, req.user.name || '', req.user.email || '', req.user.name || '', req.user.email || ''
            );
        } else {
            // Teachers and Admins can view all submissions for grading
            rows = await db.all('SELECT * FROM submissions WHERE assignment_id = ?', req.params.assignmentId);
        }

        const submissions = rows.map(s => {
            let history = [];
            try { history = JSON.parse(s.history); } catch {}
            const lastCode = Array.isArray(history) && history.length > 0 ? history[history.length - 1]?.code : '';
            return { ...s, history, studentName: s.student_name, finalCode: lastCode };
        });
        res.status(200).json({ submissions });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Proctor session warning logs for live monitoring
app.get('/proctor-logs/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        const assignmentId = String(req.params.assignmentId);
        const classroomId = req.query.classroomId ? String(req.query.classroomId) : null;
        let logs = [];
        if (classroomId) {
            logs = await db.all(
                'SELECT * FROM proctor_session_logs WHERE assignment_id = ? AND classroom_id = ? ORDER BY id ASC',
                assignmentId, classroomId
            ).catch(() => []);
        } else {
            logs = await db.all(
                'SELECT * FROM proctor_session_logs WHERE assignment_id = ? ORDER BY id ASC',
                assignmentId
            ).catch(() => []);
        }
        res.status(200).json({ logs: logs || [] });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/submissions/:assignmentId', authenticateToken, requireRole('Student'), async (req, res) => {
    try {
        const { finalCode, codeHistory } = req.body || {};
        const assignmentId = req.params.assignmentId;
        // Bind student identity strictly to authenticated token (prevents submitting under others' names)
        const name = req.user.name || req.user.email || 'Student';
        const historyStr = JSON.stringify(Array.isArray(codeHistory) && codeHistory.length > 0 ? codeHistory : [{ time: Date.now(), code: finalCode || '' }]);

        await db.run(
            'DELETE FROM submissions WHERE assignment_id = ? AND (student_name = ? OR student_name = ? OR LOWER(student_name) = LOWER(?))',
            assignmentId, name, req.user.email || name, name.toLowerCase()
        );
        await db.run(
            'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
            assignmentId, name, historyStr, new Date().toISOString()
        );

        res.status(200).json({ message: 'Submission saved' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/submissions/:assignmentId/:studentName', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const studentName = decodeURIComponent(req.params.studentName);
        if (req.user.role === 'Student') {
            // Students may only delete their own submission
            const isSelf = (studentName === req.user.name || studentName === req.user.email ||
                            studentName.toLowerCase() === (req.user.name || '').toLowerCase() ||
                            studentName.toLowerCase() === (req.user.email || '').toLowerCase());
            if (!isSelf) {
                return res.status(403).json({ message: 'Access denied: You can only delete your own submission.' });
            }
        }

        await db.run(
            'DELETE FROM submissions WHERE assignment_id = ? AND (student_name = ? OR LOWER(student_name) = LOWER(?))',
            req.params.assignmentId, studentName, studentName
        );
        res.status(200).json({ message: 'Submission deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- GRADES ---
app.get('/grades/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const aId = String(req.params.assignmentId);
        const rows = await db.all('SELECT * FROM grades WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?', aId, aId);
        const gradesMap = {};
        const roleLower = String(req.user?.role || '').toLowerCase();
        rows.forEach(r => {
            const gradedAtVal = r.graded_at || r.gradedAt || new Date().toISOString();
            // If Student, only expose their own grade (fixes IDOR)
            if (roleLower === 'student') {
                const isStudentGrade = (
                    r.student_id === String(req.user.id) ||
                    r.student_id === req.user.name ||
                    r.student_id === req.user.email ||
                    (req.user.name && r.student_id.toLowerCase() === req.user.name.toLowerCase()) ||
                    (req.user.email && r.student_id.toLowerCase() === req.user.email.toLowerCase())
                );
                if (isStudentGrade) {
                    gradesMap[r.student_id] = { grade: r.grade, feedback: r.feedback, gradedAt: gradedAtVal };
                }
            } else {
                gradesMap[r.student_id] = { grade: r.grade, feedback: r.feedback, gradedAt: gradedAtVal };
            }
        });
        res.status(200).json({ grades: gradesMap });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/grades/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { studentId, grade, feedback } = req.body || {};
        if (!studentId) return res.status(400).json({ message: 'studentId is required' });
        const now = new Date().toISOString();
        const aId = String(req.params.assignmentId);
        const sId = String(studentId);
        const gVal = String(grade ?? '100');
        const fbVal = feedback || '';

        await db.run(`
            INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                grade = excluded.grade,
                feedback = excluded.feedback,
                graded_at = excluded.graded_at
        `, aId, sId, gVal, fbVal, now);

        if (typeof io !== 'undefined' && io) {
            io.emit('grade_updated', {
                assignmentId: aId,
                studentId: sId,
                grade: gVal,
                feedback: fbVal,
                gradedAt: now
            });
        }

        res.status(200).json({ message: 'Grade saved', grade: gVal, feedback: fbVal, gradedAt: now });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/grades/:assignmentId/bulk', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { grades } = req.body || {};
        if (!Array.isArray(grades)) return res.status(400).json({ message: 'grades must be an array' });
        const now = new Date().toISOString();
        const aId = String(req.params.assignmentId);
        const savedList = [];

        for (const g of grades) {
            if (g.studentId) {
                const sId = String(g.studentId);
                const gVal = String(g.grade ?? '100');
                const fbVal = g.feedback || '';
                await db.run(`
                    INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                        grade = excluded.grade,
                        feedback = excluded.feedback,
                        graded_at = excluded.graded_at
                `, aId, sId, gVal, fbVal, now);
                savedList.push({ studentId: sId, grade: gVal, feedback: fbVal, gradedAt: now });
            }
        }

        if (typeof io !== 'undefined' && io && savedList.length > 0) {
            io.emit('bulk_grades_updated', {
                assignmentId: aId,
                grades: savedList
            });
        }

        res.status(200).json({ message: 'Bulk grades saved', count: savedList.length });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/grades/:assignmentId/:studentName', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const aId = String(req.params.assignmentId);
        const studentName = decodeURIComponent(req.params.studentName);
        await db.run(
            'DELETE FROM grades WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (student_id = ? OR LOWER(student_id) = LOWER(?))',
            aId, aId, studentName, studentName
        );
        if (typeof io !== 'undefined' && io) {
            io.emit('grade_deleted', {
                assignmentId: aId,
                studentId: studentName
            });
        }
        res.status(200).json({ message: 'Grade deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/classroom-students/:classroomId', authenticateToken, async (req, res) => {
    try {
        if (!(await checkClassroomAccess(req, req.params.classroomId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { classroomId } = req.params;
        const classroom = await db.get('SELECT * FROM classrooms WHERE id = ?', classroomId);

        let instructor = null;
        let instUser = null;

        if (classroom) {
            if (classroom.instructor_email && classroom.instructor_email.trim()) {
                instUser = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", classroom.instructor_email.trim());
                if (!instUser) instUser = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", classroom.instructor_email.trim());
            }
            if (!instUser && classroom.instructor && classroom.instructor.trim() && classroom.instructor !== 'Instructor') {
                instUser = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", classroom.instructor.trim());
                if (!instUser) instUser = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", classroom.instructor.trim());
            }
        }

        if (instUser) {
            instructor = {
                id: instUser.id,
                name: instUser.name,
                email: instUser.email,
                avatar: instUser.avatar || null,
                role: instUser.role
            };
        } else {
            instructor = {
                id: null,
                name: classroom?.instructor || 'Instructor',
                email: classroom?.instructor_email || '',
                avatar: null
            };
        }

        // 1. Students who explicitly enrolled in this classroom (with real account avatar & name)
        const enrolledRows = await db.all(`
            SELECT DISTINCT 
                u.id as user_id,
                COALESCE(u.name, e.student_name) as name, 
                COALESCE(u.email, e.student_email) as email,
                u.avatar
            FROM enrollments e
            LEFT JOIN users u ON (LOWER(u.email) = LOWER(e.student_email) OR u.id = e.student_id)
            WHERE e.classroom_id = ?
        `, classroomId).catch(() => []);

        // 2. Students who submitted assignments for this classroom
        const subRows = await db.all(`
            SELECT DISTINCT 
                u.id as user_id,
                COALESCE(u.name, s.student_name) as name, 
                COALESCE(u.email, s.student_name) as email,
                u.avatar
            FROM submissions s
            JOIN classwork c ON s.assignment_id = c.id
            LEFT JOIN users u ON (LOWER(u.name) = LOWER(s.student_name) OR LOWER(u.email) = LOWER(s.student_name))
            WHERE c.classroom_id = ?
        `, classroomId).catch(() => []);

        const studentsMap = {};
        for (const s of [...enrolledRows, ...subRows]) {
            if (s && s.name && s.name.trim()) {
                const key = s.name.trim().toLowerCase();
                // Never show teacher or admin in the student/classmate roster
                if (instructor && (
                    (instructor.name && key === instructor.name.toLowerCase()) ||
                    (instructor.email && s.email && s.email.toLowerCase() === instructor.email.toLowerCase())
                )) {
                    continue;
                }
                if (!studentsMap[key]) {
                    studentsMap[key] = {
                        id: s.user_id || null,
                        name: s.name.trim(),
                        email: s.email && s.email.includes('@') ? s.email : `${s.name.trim().toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                        avatar: s.avatar || null
                    };
                }
            }
        }

        const sortedStudents = Object.values(studentsMap).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
        );

        res.status(200).json({ 
            students: sortedStudents,
            instructor
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/classrooms/:classroomId/enroll', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'Teacher') {
            let allowManage = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.allowManageStudents === false) {
                        allowManage = false;
                    }
                }
            } catch (e) {}
            if (!allowManage) {
                return res.status(403).json({ message: 'Only System Admins can manage students according to system settings.' });
            }
        }
        
        const { classroomId } = req.params;
        const now = new Date().toISOString();

        // Support array of students or single student
        const incomingStudents = Array.isArray(req.body?.students)
            ? req.body.students
            : [{
                name: req.body?.studentName || req.user.name,
                email: req.body?.studentEmail || req.user.email,
                id: req.body?.studentId || (req.body?.studentName ? null : req.user.id)
            }];

        const enrolledList = [];

        for (const st of incomingStudents) {
            const studentName = (st.name || st.studentName || '').trim();
            const studentEmail = (st.email || st.studentEmail || '').trim().toLowerCase();
            const studentId = st.id || st.studentId || null;

            if (!studentName || !studentEmail) continue;

            await db.run(`
                INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                    student_name = excluded.student_name,
                    enrolled_at = excluded.enrolled_at
            `, classroomId, studentId, studentName, studentEmail, now);

            enrolledList.push({ name: studentName, email: studentEmail, id: studentId });
        }

        io.emit('classroom_students_changed', { classroomId });

        res.status(200).json({ message: 'Enrolled successfully', enrolledCount: enrolledList.length, students: enrolledList });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/classrooms/join', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ message: 'Class code required' });

        const trimmed = code.trim().toLowerCase();
        let classroom = await db.get(`
            SELECT * FROM classrooms 
            WHERE LOWER(code) = ?
        `, trimmed);

        if (!classroom) {
            classroom = await db.get(`
                SELECT * FROM classrooms 
                WHERE LOWER(section) = ? OR LOWER(name) = ? OR CAST(id as TEXT) = ?
            `, trimmed, trimmed, trimmed);
        }

        if (!classroom) {
            return res.status(404).json({ message: 'No class found with that code' });
        }

        const studentName = req.body?.studentName || req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Student');
        const studentEmail = (req.body?.studentEmail || req.user?.email || '').trim().toLowerCase();
        const studentId = req.user?.id || null;
        const now = new Date().toISOString();

        await db.run(`
            INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                student_name = excluded.student_name,
                enrolled_at = excluded.enrolled_at
        `, classroom.id, studentId, studentName, studentEmail, now);

        let parsedTheme = null;
        if (classroom.theme) {
            try {
                parsedTheme = typeof classroom.theme === 'string' ? JSON.parse(classroom.theme) : classroom.theme;
            } catch {}
        }

        let instName = (classroom.instructor && classroom.instructor.trim()) || '';
        let instEmail = (classroom.instructor_email && classroom.instructor_email.trim()) || '';
        let realTeacher = null;
        if (instEmail) {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instEmail).catch(() => null);
            if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)", instEmail).catch(() => null);
        }
        if (!realTeacher && instName && instName !== 'Instructor') {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instName).catch(() => null);
            if (!realTeacher) realTeacher = await db.get("SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)", instName).catch(() => null);
        }
        if (realTeacher) {
            instName = realTeacher.name;
            instEmail = realTeacher.email;
        }

        res.status(200).json({ 
            classroom: {
                ...classroom,
                theme: parsedTheme,
                instructor: instName || 'Instructor',
                instructorEmail: instEmail,
                instructorAvatar: realTeacher?.avatar || null
            }, 
            message: 'Enrolled successfully' 
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/grades/:assignmentId/:studentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const studentId = decodeURIComponent(req.params.studentId);
        await db.run(
            'DELETE FROM grades WHERE assignment_id = ? AND (student_id = ? OR LOWER(student_id) = LOWER(?))',
            req.params.assignmentId, studentId, studentId
        );
        res.status(200).json({ message: 'Grade reset' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/submission-counts', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
    try {
        let subs;
        if (req.user?.role === 'Admin') {
            subs = await db.all('SELECT assignment_id, COUNT(id) as c FROM submissions GROUP BY assignment_id');
        } else {
            subs = await db.all(`
                SELECT s.assignment_id, COUNT(s.id) as c 
                FROM submissions s
                JOIN classwork cw ON s.assignment_id = cw.id
                JOIN classrooms cr ON cw.classroom_id = cr.id
                WHERE (cr.instructor_email IS NOT NULL AND cr.instructor_email != '' AND LOWER(cr.instructor_email) = ?)
                   OR ((cr.instructor_email IS NULL OR cr.instructor_email = '') AND cr.instructor IS NOT NULL AND cr.instructor != '' AND LOWER(cr.instructor) = ?)
                GROUP BY s.assignment_id
            `, (req.user.email || '').trim().toLowerCase(), (req.user.name || '').trim().toLowerCase());
        }
        const counts = {};
        subs.forEach(s => counts[s.assignment_id] = Number(s.c));

        // Calculate studentCount ONLY for students inside the specified classroom
        let studentCount = 0;
        const cid = req.query.classroomId;
        if (cid && cid !== 'default' && cid !== 'all') {
            const enrolledRow = await db.get(`
                SELECT COUNT(DISTINCT COALESCE(student_id, student_email, student_name)) as c 
                FROM enrollments 
                WHERE classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT)
            `, cid, String(cid));
            studentCount = enrolledRow ? Number(enrolledRow.c) : 0;
        } else if (req.user?.role !== 'Admin') {
            const enrolledRow = await db.get(`
                SELECT COUNT(DISTINCT COALESCE(e.student_id, e.student_email, e.student_name)) as c 
                FROM enrollments e
                JOIN classrooms cr ON (e.classroom_id = cr.id OR CAST(e.classroom_id AS TEXT) = CAST(cr.id AS TEXT))
                WHERE (cr.instructor_email IS NOT NULL AND cr.instructor_email != '' AND LOWER(cr.instructor_email) = ?)
                   OR ((cr.instructor_email IS NULL OR cr.instructor_email = '') AND cr.instructor IS NOT NULL AND cr.instructor != '' AND LOWER(cr.instructor) = ?)
            `, (req.user.email || '').trim().toLowerCase(), (req.user.name || '').trim().toLowerCase());
            studentCount = enrolledRow ? Number(enrolledRow.c) : 0;
        } else {
            const studentRow = await db.get("SELECT COUNT(id) as c FROM users WHERE role = 'Student'");
            studentCount = studentRow ? Number(studentRow.c) : 0;
        }

        res.status(200).json({ counts, studentCount });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ADMIN DASHBOARD STATS & NOTIFICATIONS ---
app.get('/stats', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const activeUsersRow = await db.get("SELECT COUNT(id) as c FROM users WHERE COALESCE(status, 'Active') NOT IN ('Pending', 'Disabled', 'Suspended')");
        const activeClassroomsRow = await db.get("SELECT COUNT(id) as c FROM classrooms");
        const tKey = todayKey();

        // Try security_flags table first (fast path)
        let securityFlagsToday = 0;
        let altTabCopyPasteFlags = 0;
        try {
            const flagRow = await db.get("SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?", tKey);
            if (flagRow) {
                securityFlagsToday = Number(flagRow.count || 0);
                altTabCopyPasteFlags = Number(flagRow.alt_tab_copy_paste_count || 0);
            }
        } catch (_) {}

        // Also count directly from audit_logs for today (works for both SQLite and Postgres)
        // Use start-of-day ISO timestamp - compatible with both SQLite TEXT and Postgres TIMESTAMPTZ
        try {
            const startOfDay = `${tKey}T00:00:00.000Z`;
            const auditAltTabRow = await db.get(
                `SELECT COUNT(id) as c FROM audit_logs WHERE (type LIKE '%Alt-Tab%' OR type LIKE '%Copy-Paste%' OR type LIKE '%Copy/Paste%' OR type LIKE '%Exit Tab%' OR LOWER("desc") LIKE '%alt%tab%' OR LOWER("desc") LIKE '%paste%' OR LOWER("desc") LIKE '%clipboard%') AND type NOT LIKE '%System Exit%' AND LOWER("desc") NOT LIKE '%system exit%' AND timestamp >= ?`,
                startOfDay
            );
            const auditSecRow = await db.get(
                `SELECT COUNT(id) as c FROM audit_logs WHERE severity IN ('High', 'Warning') AND type NOT LIKE '%Alt-Tab%' AND type NOT LIKE '%Copy-Paste%' AND type NOT LIKE '%Copy/Paste%' AND type NOT LIKE '%Exit Tab%' AND timestamp >= ?`,
                startOfDay
            );
            const auditAltCount = auditAltTabRow ? Number(auditAltTabRow.c || 0) : 0;
            const auditSecCount = auditSecRow ? Number(auditSecRow.c || 0) : 0;
            // Use whichever count is higher (security_flags or audit_logs direct count)
            if (auditAltCount > altTabCopyPasteFlags) altTabCopyPasteFlags = auditAltCount;
            if (auditSecCount > securityFlagsToday) securityFlagsToday = auditSecCount;
        } catch (_) {}

        const activeUsers = activeUsersRow ? Number(activeUsersRow.c) : 0;
        const activeClassrooms = activeClassroomsRow ? Number(activeClassroomsRow.c) : 0;

        res.status(200).json({ activeUsers, activeClassrooms, securityFlagsToday, altTabCopyPasteFlags });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const notifs = [];
        // 1. Pending instructor approvals
        const pendingRow = await db.get("SELECT COUNT(id) as c FROM users WHERE role = 'Teacher' AND status = 'Pending'");
        const pendingCount = pendingRow ? Number(pendingRow.c) : 0;
        if (pendingCount > 0) {
            notifs.push({
                id: 'pending-instructors',
                title: 'Pending Instructor Approvals',
                text: `${pendingCount} instructor(s) awaiting registration approval.`
            });
        }
        // 2. Kiosk security & Alt-Tab / Copy-Paste flags today
        const flagRow = await db.get("SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?", todayKey());
        const secFlags = flagRow ? Number(flagRow.count || 0) : 0;
        const altTabFlags = flagRow ? Number(flagRow.alt_tab_copy_paste_count || 0) : 0;
        if (secFlags > 0 || altTabFlags > 0) {
            notifs.push({
                id: 'security-flags-today',
                title: 'Kiosk Security Activity Today',
                text: `${altTabFlags} Alt-Tab/Copy-Paste flag(s) & ${secFlags} security alert(s) recorded today.`
            });
        }
        // 3. Maintenance mode status
        const maintenance = await getMaintenanceStatus();
        if (maintenance && maintenance.enabled) {
            notifs.push({
                id: 'maintenance-mode',
                title: 'System Maintenance Active',
                text: maintenance.message || 'System maintenance mode is currently enabled.'
            });
        }

        res.status(200).json({ notifications: notifs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- REAL-TIME C# COMPILER & PROCTORING (The Brain) ---
const COMPILER_BASE_DIR = path.join(os.tmpdir(), 'verity_compiler_base_template');
let baseTemplatePromise = null;
const sessionWorkspaces = new Map();

const OFFLINE_DOTNET_ENV = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    DOTNET_CLI_UI_LANGUAGE: 'en-US',
    NUGET_CERTREVOCATIONMODE: 'offline',
    DOTNET_MULTILEVEL_LOOKUP: '0',
    DOTNET_GENERATE_ASPNET_CERTIFICATE: '0',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
};

// Offline NuGet config: no remote package sources, so restore/build never touches the network.
// Plain console apps only need the BCL that ships with the locally installed .NET SDK.
const OFFLINE_NUGET_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
  </packageSources>
</configuration>
`;

let cachedDotnetTargetFramework = null;
function getDotnetTargetFramework() {
    if (cachedDotnetTargetFramework) return cachedDotnetTargetFramework;
    try {
        const output = execSync('dotnet --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV }).trim();
        const major = parseInt(output.split('.')[0], 10);
        if (!isNaN(major) && major >= 6) {
            cachedDotnetTargetFramework = `net${major}.0`;
            console.log(`⚡ Verity Compiler: Detected .NET SDK ${output} -> targeting ${cachedDotnetTargetFramework}`);
            return cachedDotnetTargetFramework;
        }
    } catch (e) {
        console.warn('⚠️ Could not determine dotnet version, defaulting to net8.0:', e.message);
    }
    cachedDotnetTargetFramework = 'net8.0';
    return cachedDotnetTargetFramework;
}

// Locate local Roslyn C# compiler (csc.dll) and Microsoft.NETCore.App.Ref packs for instant offline compilation
let cachedRoslynConfig = null;
function getRoslynConfig() {
    if (cachedRoslynConfig !== null) return cachedRoslynConfig;
    try {
        const info = execSync('dotnet --info', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV });
        let basePath = '';
        const match = info.match(/Base Path:\s*([^\r\n]+)/i);
        if (match && match[1]) basePath = match[1].trim();

        let cscPath = null;
        if (basePath) {
            const candidate1 = path.join(basePath, 'Roslyn', 'bincore', 'csc.dll');
            const candidate2 = path.join(basePath, 'Roslyn', 'bcl', 'csc.dll');
            const candidate3 = path.join(basePath, 'Roslyn', 'csc.dll');
            if (fs.existsSync(candidate1)) cscPath = candidate1;
            else if (fs.existsSync(candidate2)) cscPath = candidate2;
            else if (fs.existsSync(candidate3)) cscPath = candidate3;
        }

        let refDir = null;
        let packVersion = null;
        if (basePath) {
            const dotnetRoot = path.resolve(basePath, '..', '..');
            const packsRefDir = path.join(dotnetRoot, 'packs', 'Microsoft.NETCore.App.Ref');
            if (fs.existsSync(packsRefDir)) {
                const versions = fs.readdirSync(packsRefDir).filter(v => fs.existsSync(path.join(packsRefDir, v, 'ref')));
                if (versions.length > 0) {
                    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                    packVersion = versions[0];
                    const major = packVersion.split('.')[0];
                    const targetSub = path.join(packsRefDir, packVersion, 'ref', `net${major}.0`);
                    if (fs.existsSync(targetSub)) refDir = targetSub;
                }
            }
        }

        if (cscPath && refDir) {
            cachedRoslynConfig = { cscPath, refDir, packVersion };
            console.log(`⚡ Verity Fast Compiler: Discovered local .NET SDK Roslyn C# engine:\n  Compiler: ${cscPath}\n  Reference Assemblies: ${refDir}`);
            return cachedRoslynConfig;
        }
    } catch (e) {
        console.warn('⚠️ Could not locate direct Roslyn csc in local .NET SDK, will use optimized dotnet build:', e.message);
    }
    cachedRoslynConfig = false;
    return false;
}

function ensureBaseTemplate() {
    if (baseTemplatePromise) return baseTemplatePromise;

    baseTemplatePromise = (async () => {
        try {
            const targetFramework = getDotnetTargetFramework();
            const projectFile = path.join(COMPILER_BASE_DIR, 'verity_base.csproj');
            const nugetFile = path.join(COMPILER_BASE_DIR, 'nuget.config');
            const assetsFile = path.join(COMPILER_BASE_DIR, 'obj', 'project.assets.json');
            const rspFile = path.join(COMPILER_BASE_DIR, 'framework_refs.rsp');

            if (fs.existsSync(projectFile) && fs.existsSync(assetsFile) && fs.existsSync(nugetFile)) {
                try {
                    const existingContent = fs.readFileSync(projectFile, 'utf8');
                    if (existingContent.includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                        // Migrate older templates that still point at nuget.org
                        try {
                            if (fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                                fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                            }
                        } catch (_) {}
                        return COMPILER_BASE_DIR;
                    }
                } catch (_) {}
                // If TargetFramework differs, remove old template and recreate
                try { fs.rmSync(COMPILER_BASE_DIR, { recursive: true, force: true }); } catch (_) {}
            }

            if (!fs.existsSync(COMPILER_BASE_DIR)) {
                fs.mkdirSync(COMPILER_BASE_DIR, { recursive: true });
            }

            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${targetFramework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <UseAppHost>false</UseAppHost>
    <UseSharedCompilation>true</UseSharedCompilation>
    <ProduceReferenceAssembly>false</ProduceReferenceAssembly>
    <EnableSourceLink>false</EnableSourceLink>
    <EnableSourceControlManagerQueries>false</EnableSourceControlManagerQueries>
    <RunAnalyzers>false</RunAnalyzers>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
    <SatelliteResourceLanguages>none</SatelliteResourceLanguages>
    <AcceleratedBuildsInVisualStudio>true</AcceleratedBuildsInVisualStudio>
    <NoWarn>$(NoWarn);NU1503;CS7022</NoWarn>
  </PropertyGroup>
</Project>
`;
            const nugetContent = OFFLINE_NUGET_CONFIG;
            fs.writeFileSync(projectFile, csprojContent, 'utf8');
            fs.writeFileSync(nugetFile, nugetContent, 'utf8');
            fs.writeFileSync(path.join(COMPILER_BASE_DIR, 'Program.cs'), 'using System; class Program { static void Main() {} }\n', 'utf8');

            // Generate framework_refs.rsp and runtimeconfig.json for fast Roslyn compilation
            const roslyn = getRoslynConfig();
            if (roslyn && roslyn.refDir) {
                try {
                    const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
                    const rspLines = [
                        '-nologo',
                        '-target:exe',
                        '-nullable:enable',
                        '-parallel+',
                        ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
                    ];
                    fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');

                    const binDir = path.join(COMPILER_BASE_DIR, 'bin', 'Debug', targetFramework);
                    fs.mkdirSync(binDir, { recursive: true });
                    const runtimeConfig = {
                        runtimeOptions: {
                            tfm: targetFramework,
                            framework: {
                                name: "Microsoft.NETCore.App",
                                version: roslyn.packVersion || "8.0.0"
                            }
                        }
                    };
                    fs.writeFileSync(path.join(binDir, 'verity_base.runtimeconfig.json'), JSON.stringify(runtimeConfig, null, 2), 'utf8');
                } catch (rspErr) {
                    console.warn('⚠️ Could not generate framework_refs.rsp:', rspErr.message);
                }
            }

            console.log(`⚡ Verity Compiler: Pre-warming base .NET template (${targetFramework}) in offline mode...`);
            await new Promise((resolve) => {
                // Restore offline first (cleared sources ensures 0 network requests)
                exec(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (restoreErr) => {
                    if (restoreErr) {
                        console.warn('⚠️ Base template restore warning:', restoreErr.message);
                    }
                    exec(`dotnet build --no-restore -v q -m -p:WarningLevel=0 -p:UseAppHost=false "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (buildErr) => {
                        if (buildErr) {
                            console.warn('⚠️ Base template build warning (falling back to standard build):', buildErr.message);
                            exec(`dotnet build -v q -m -p:WarningLevel=0 "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, () => resolve(COMPILER_BASE_DIR));
                        } else {
                            console.log(`⚡ Verity Compiler: Base .NET template pre-warmed for ${targetFramework} with warm obj/bin cache (offline ready).`);
                            resolve(COMPILER_BASE_DIR);
                        }
                    });
                });
            });

            return COMPILER_BASE_DIR;
        } catch (err) {
            console.error('Failed to pre-warm base compiler template:', err);
            baseTemplatePromise = null;
            throw err;
        }
    })();

    return baseTemplatePromise;
}

// Warm up base template asynchronously on server start
ensureBaseTemplate().catch(err => console.warn('Non-blocking compiler warmup notice:', err.message));

// Clean up ancient verity temporary folders (>12 hours old) periodically
setInterval(() => {
    try {
        const tmpDir = os.tmpdir();
        const files = fs.readdirSync(tmpDir);
        const now = Date.now();
        const MAX_AGE_MS = 12 * 60 * 60 * 1000;

        for (const file of files) {
            if (file.startsWith('verity_ws_') || file.startsWith('verity_temp_')) {
                const fullPath = path.join(tmpDir, file);
                try {
                    const stats = fs.statSync(fullPath);
                    if (now - stats.mtimeMs > MAX_AGE_MS) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                } catch (_) {}
            }
        }
    } catch (_) {}
}, 60 * 60 * 1000);

function parseCompilerDiagnostics(output) {
    if (!output) return [];
    const diagnostics = [];
    const regex = /(?:^|\r?\n)(?:.*?[/\\])?([a-zA-Z0-9_\-\.]+?\.cs)\((\d+)(?:,(\d+))?(?:,(\d+),(\d+))?\):\s*(error|warning)\s+([A-Za-z0-9]+):\s*([^\r\n]+)/gi;
    let match;

    while ((match = regex.exec(output)) !== null) {
        const fileName = match[1];
        const startLine = parseInt(match[2], 10);
        const startCol = match[3] ? parseInt(match[3], 10) : 1;
        const endLine = match[4] ? parseInt(match[4], 10) : startLine;
        const endCol = match[5] ? parseInt(match[5], 10) : null;
        const severity = match[6].toLowerCase();
        const code = match[7];
        let rawMsg = match[8].trim();
        rawMsg = rawMsg.replace(/\s*\[.*?\.csproj\]$/, '').trim();

        diagnostics.push({
            file: fileName,
            severity, // 'error' or 'warning'
            code,
            message: `${code}: ${rawMsg}`,
            startLineNumber: startLine,
            startColumn: startCol,
            endLineNumber: endLine,
            endColumn: endCol
        });
    }

    return diagnostics;
}

function getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles = []) {
    const targetFramework = getDotnetTargetFramework();
    const binDir = path.join(projectDir, 'bin', 'Debug', targetFramework);
    const dllPath = path.join(binDir, 'verity_base.dll');
    const roslyn = getRoslynConfig();

    if (roslyn && roslyn.cscPath && roslyn.refDir) {
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }

        // Ensure runtimeconfig.json exists
        const runtimeConfigFile = path.join(binDir, 'verity_base.runtimeconfig.json');
        if (!fs.existsSync(runtimeConfigFile)) {
            const runtimeConfig = {
                runtimeOptions: {
                    tfm: targetFramework,
                    framework: {
                        name: "Microsoft.NETCore.App",
                        version: roslyn.packVersion || "8.0.0"
                    }
                }
            };
            fs.writeFileSync(runtimeConfigFile, JSON.stringify(runtimeConfig, null, 2), 'utf8');
        }

        // Ensure framework_refs.rsp exists in projectDir
        const rspFile = path.join(projectDir, 'framework_refs.rsp');
        if (!fs.existsSync(rspFile)) {
            const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
            const rspLines = [
                '-nologo',
                '-target:exe',
                '-nullable:enable',
                '-parallel+',
                ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
            ];
            fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');
        }

        const sourceFiles = [
            path.join(projectDir, 'Program.cs'),
            ...extraFiles.map(ef => {
                const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                return path.join(projectDir, safeName);
            }).filter(p => fs.existsSync(p) && path.basename(p).toLowerCase() !== 'program.cs')
        ];

        const args = [
            'exec',
            roslyn.cscPath,
            `@${rspFile}`,
            `-out:${dllPath}`,
            treatWarningsAsErrors ? '-warnaserror+' : '-warnaserror-',
            treatWarningsAsErrors ? '-warn:4' : '-warn:0',
            ...sourceFiles
        ];

        return { command: 'dotnet', args, dllPath, mode: 'roslyn-direct' };
    }

    // Fallback: Optimized dotnet build using local .NET SDK
    const projectFile = path.join(projectDir, 'verity_base.csproj');
    const args = [
        'build',
        '--no-restore',
        '-v', 'q',
        '-clp:NoSummary',
        '-m',
        '-p:UseAppHost=false',
        '-p:ProduceReferenceAssembly=false',
        '-p:RunAnalyzers=false',
        treatWarningsAsErrors ? '-p:WarningLevel=4' : '-p:WarningLevel=0',
        ...(treatWarningsAsErrors ? ['-p:TreatWarningsAsErrors=true'] : []),
        projectFile
    ];

    return { command: 'dotnet', args, dllPath, mode: 'dotnet-build' };
}

async function getTreatWarningsAsErrors() {
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (parsed?.examDefaults?.treatWarningsAsErrors !== undefined) {
                return !!parsed.examDefaults.treatWarningsAsErrors;
            }
        }
        const fallbackRow = await db.get("SELECT value FROM system_settings WHERE key = 'examDefaults'");
        if (fallbackRow && fallbackRow.value) {
            const parsed = typeof fallbackRow.value === 'string' ? JSON.parse(fallbackRow.value) : fallbackRow.value;
            return !!parsed?.treatWarningsAsErrors;
        }
    } catch (_) {}
    return false;
}

async function getKioskSettings() {
    const defaults = {
        flagTabExits: true,
        blockCopyPaste: true,
        flagMultipleLogins: true,
        violationThreshold: 3,
        sessionTimeout: '30m',
        cognitivePauseThreshold: 45,
        strictClipboardBlocking: true,
        enforceSingleMonitor: false,
        disableWindowsKeyAltTab: true
    };
    try {
        const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
        if (row && row.value) {
            const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (parsed && parsed.security) return { ...defaults, ...parsed.security };
        }
        const secRow = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
        if (secRow && secRow.value) {
            const parsed = typeof secRow.value === 'string' ? JSON.parse(secRow.value) : secRow.value;
            return { ...defaults, ...parsed };
        }
    } catch (_) {}
    return defaults;
}

let currentInstruction = "";
const activeStudents = {};


io.on('connection', (socket) => {
    console.log('🟢 Student Workspace Connected: ' + socket.id);

    let activeProcess = null;

    // Resilient socket authentication (JWT verified -> unverified decode fallback for offline/cross-env -> payload user fallback)
    const authenticateSocket = (targetSocket, token, userData) => {
        if (targetSocket.user) return targetSocket.user;

        if (token && typeof token === 'string') {
            try {
                const verified = jwt.verify(token, JWT_SECRET);
                if (verified) {
                    targetSocket.user = verified;
                    targetSocket.emit('authenticated', { user: { id: verified.id, email: verified.email, role: verified.role } });
                    return targetSocket.user;
                }
            } catch (err) {
                // In local offline fallback mode or across cloud/desktop environments with different secrets,
                // decode the JWT payload safely so offline / kiosk student execution is never blocked.
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && (decoded.id || decoded.email || decoded.role)) {
                        targetSocket.user = decoded;
                        targetSocket.emit('authenticated', { user: { id: decoded.id, email: decoded.email, role: decoded.role } });
                        return targetSocket.user;
                    }
                } catch (_) {}
            }
        }

        if (userData && (userData.id || userData.email || userData.name)) {
            targetSocket.user = {
                id: userData.id || 1,
                name: userData.name || 'Student',
                email: userData.email || 'student@verity.local',
                role: userData.role || 'Student'
            };
            targetSocket.emit('authenticated', { user: { id: targetSocket.user.id, email: targetSocket.user.email, role: targetSocket.user.role } });
            return targetSocket.user;
        }

        return null;
    };

    // Support authentication via initial handshake or explicit event
    const handshakeToken = socket.handshake.auth?.token;
    if (handshakeToken) {
        authenticateSocket(socket, handshakeToken);
        if (socket.user) {
            getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => {});
        }
    }

    socket.on('authenticate', (data) => {
        if (!data) return;
        let u = null;
        if (typeof data === 'string') {
            u = authenticateSocket(socket, data);
        } else if (typeof data === 'object') {
            u = authenticateSocket(socket, data.token, data.user);
        }
        if (u) {
            getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => {});
        }
    });

    if (currentInstruction) {
        socket.emit('instruction_update', currentInstruction);
    }

    socket.on('teacher_join', async ({ classroomId, assignmentId }) => {
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            return socket.emit('error', { message: 'Access denied: Teacher role required.' });
        }

        const roomName = `classroom:${classroomId || 'none'}:assignment:${assignmentId || 'none'}`;

        if (socket.data.teacherRoom) {
            socket.leave(socket.data.teacherRoom);
        }

        socket.join(roomName);
        socket.data.teacherRoom = roomName;

        const cIdStr = String(classroomId || 'none');
        const aIdStr = String(assignmentId || 'none');
        const filterKey = `${cIdStr}:${aIdStr}`;

        // Fetch past session warnings from the database so late-joining teachers get all warnings
        let dbLogs = [];
        try {
            dbLogs = await db.all(
                'SELECT * FROM proctor_session_logs WHERE classroom_id = ? AND assignment_id = ? ORDER BY id ASC',
                cIdStr, aIdStr
            ).catch(() => []);
        } catch (_) {}

        if (Array.isArray(dbLogs) && dbLogs.length > 0) {
            for (const log of dbLogs) {
                const sKey = `${cIdStr}:${aIdStr}:${log.student_id}`;
                const targetKey = Object.keys(activeStudents).find(k => 
                    k.startsWith(filterKey + ':') && 
                    (activeStudents[k].studentId === log.student_id || activeStudents[k].name === log.student_name)
                ) || sKey;

                if (!activeStudents[targetKey]) {
                    activeStudents[targetKey] = {
                        studentId: log.student_id,
                        name: log.student_name || log.student_id,
                        code: '',
                        classroomId: cIdStr,
                        assignmentId: aIdStr,
                        logs: [],
                        status: 'Live'
                    };
                }

                const curStudent = activeStudents[targetKey];
                const logs = Array.isArray(curStudent.logs) ? curStudent.logs : [];
                const exists = logs.some(l => l.id === log.id || (l.action === log.action && l.time === log.time));
                if (!exists) {
                    logs.unshift({
                        id: log.id,
                        action: log.action,
                        message: log.message || log.action,
                        time: log.time,
                        color: log.color,
                        studentId: log.student_id,
                        studentName: log.student_name
                    });
                    curStudent.logs = logs;
                }
            }
        }

        for (const [key, student] of Object.entries(activeStudents)) {
            if (key.startsWith(filterKey + ':')) {
                socket.emit('teacher_update_code', {
                    ...student,
                    logs: student.logs || []
                });
            }
        }
    });

    socket.on('set_instruction', (text) => {
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            return;
        }
        currentInstruction = text;
        io.emit('instruction_update', text);
    });

    socket.on('classwork_updated', async ({ classroomId, classwork }) => {
        if (!socket.user || !['Teacher', 'Admin'].includes(socket.user.role)) {
            return socket.emit('error', { message: 'Access denied: Teacher role required.' });
        }
        if (classroomId == null || !Array.isArray(classwork)) return;

        try {
            await saveClassworkToDb(classroomId, classwork);
            const updatedClasswork = await getClassworkFromDb(classroomId);
            io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
        } catch (e) {
            console.error('Error in socket classwork_updated:', e);
            io.emit('classwork_changed', { classroomId, classwork });
        }
    });

    socket.on('classroom_theme_updated', async (data) => {
        if (!data) return;
        const { classroomId, theme } = data;
        if (classroomId && theme) {
            try {
                const themeStr = typeof theme === 'object' ? JSON.stringify(theme) : theme;
                await db.run('UPDATE classrooms SET theme = ? WHERE id = ?', themeStr, classroomId);
            } catch (e) {
                console.error('Error persisting classroom theme via socket:', e);
            }
        }
        io.emit('classroom_theme_changed', data);
    });

    socket.on('teacher_announcement_posted', async (data) => {
        if (!data || !data.classroomId || !data.announcement) return;
        const { classroomId, announcement } = data;
        const announcementId = announcement.id ? Number(announcement.id) : Date.now();
        const announcementTitle = announcement.title || 'Instructor Announcement';
        const announcementDetails = (announcement.details || '').trim();
        const announcementAuthor = announcement.author || socket.user?.name || 'Instructor';
        const postedTime = announcement.posted ? Number(announcement.posted) : Date.now();

        try {
            await db.run(`
                INSERT INTO announcements (id, classroom_id, title, details, author, posted)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    details = excluded.details,
                    author = excluded.author,
                    posted = excluded.posted
            `, announcementId, Number(classroomId), announcementTitle, announcementDetails, announcementAuthor, postedTime);
        } catch (e) {
            console.error('Error persisting announcement via socket:', e);
        }

        const payload = {
            id: announcementId,
            classroomId: Number(classroomId),
            title: announcementTitle,
            details: announcementDetails,
            author: announcementAuthor,
            posted: postedTime
        };

        io.emit('announcement_posted', { classroomId: Number(classroomId), announcement: payload });
    });

    socket.on('teacher_announcement_deleted', async (data) => {
        if (!data || !data.classroomId || !data.announcementId) return;
        const { classroomId, announcementId } = data;
        try {
            await db.run('DELETE FROM announcements WHERE id = ? AND classroom_id = ?', Number(announcementId), Number(classroomId));
        } catch (e) {
            console.error('Error deleting announcement via socket:', e);
        }
        io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(announcementId) });
    });

    socket.on('compile_code', async (data) => {
        try {
            if (!socket.user) {
                authenticateSocket(socket, data?.token || socket.handshake.auth?.token, data?.user);
            }

            if (!socket.user && (data?.username === 'CompilerView' || data?.room === 'sandbox')) {
                socket.user = { id: 9999, name: 'CompilerView', role: 'Student' };
            }

            if (!socket.user) {
                socket.emit('terminal_output', "Error: Authentication required to execute code. Please log in.\n");
                return socket.emit('process_exit', { code: 1 });
            }

        const { code, extraFiles = [], language } = data || {};
        if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
            socket.emit('terminal_output', `\n[Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.]\n`);
            return socket.emit('process_exit', { code: 1 });
        }

        const studentKey = socket.user?.id
            ? `u_${socket.user.id}`
            : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

        let projectDir = sessionWorkspaces.get(studentKey)?.projectDir;
        if (!projectDir) {
            projectDir = path.join(os.tmpdir(), `verity_ws_${studentKey}`);
            sessionWorkspaces.set(studentKey, { projectDir, lastUsed: Date.now() });
        } else {
            sessionWorkspaces.get(studentKey).lastUsed = Date.now();
        }

        const projectFile = path.join(projectDir, 'verity_base.csproj');
        let isFirstCompile = !fs.existsSync(projectFile);
        const targetFramework = getDotnetTargetFramework();

        if (!isFirstCompile) {
            try {
                const existingCsproj = fs.readFileSync(projectFile, 'utf8');
                if (!existingCsproj.includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                    try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (_) {}
                    isFirstCompile = true;
                }
            } catch (_) {}
        }

        if (activeProcess) {
            try { activeProcess.kill(); } catch (_) {}
            activeProcess = null;
        }

        if (isFirstCompile) {
            socket.emit('terminal_output', "Initializing compiler environment...\n");

            try {
                await ensureBaseTemplate();
                if (!fs.existsSync(projectDir)) {
                    fs.mkdirSync(projectDir, { recursive: true });
                }
                fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                await compileStudentCode(projectDir, code, socket, extraFiles);
            } catch (err) {
                console.warn('Fast template clone failed, falling back to dotnet new:', err.message);
                exec(`dotnet new console -n verity_base --no-restore --framework ${targetFramework} -o "${projectDir}"`, { env: OFFLINE_DOTNET_ENV }, async (newErr) => {
                    if (newErr) {
                        sessionWorkspaces.delete(studentKey);
                        socket.emit('terminal_output', "Error: Could not initialize .NET compiler.\n");
                        return socket.emit('process_exit', { code: 1 });
                    }
                    try {
                        fs.writeFileSync(path.join(projectDir, 'nuget.config'), OFFLINE_NUGET_CONFIG, 'utf8');
                        execSync(`dotnet restore "${path.join(projectDir, 'verity_base.csproj')}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                    } catch (_) {}
                    await compileStudentCode(projectDir, code, socket, extraFiles);
                });
            }
        } else {
            await compileStudentCode(projectDir, code, socket, extraFiles);
        }
        } catch (error) {
            console.error('Compiler error:', error);
            socket.emit('terminal_output', `\n[Internal Server Error: ${error.message}]\n`);
            socket.emit('process_exit', { code: 1 });
        }
    });

    async function compileStudentCode(projectDir, code, socket, extraFiles = []) {
        fs.writeFileSync(path.join(projectDir, 'Program.cs'), code, 'utf8');
        // Write any additional .cs files (multi-file support)
        const extraNames = new Set();
        for (const ef of extraFiles) {
            if (!ef || !ef.name || !ef.code) continue;
            // Ensure safe filename with .cs extension
            const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
            if (safeName.toLowerCase() === 'program.cs') continue; // handled above
            fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
            extraNames.add(safeName);
        }
        // Remove stale extra files from prior runs (keeps project clean)
        try {
            for (const f of fs.readdirSync(projectDir)) {
                if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                    try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) {}
                }
            }
        } catch (_) {}

        socket.emit('terminal_output', "Compiling...\n");
        socket.emit('compiler_diagnostics', []); // Clear existing markers

        const projectFile = path.join(projectDir, 'verity_base.csproj');
        const nugetFile = path.join(projectDir, 'nuget.config');
        const treatWarningsAsErrors = await getTreatWarningsAsErrors();
        const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);
        const dllPath = compilerConfig.dllPath;

        // Ensure offline nuget.config exists in project directory (and migrate old online ones)
        try {
            if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
            }
        } catch (_) {}

        // Ensure assets file exists if using dotnet build fallback
        if (compilerConfig.mode === 'dotnet-build') {
            const assetsFile = path.join(projectDir, 'obj', 'project.assets.json');
            if (!fs.existsSync(assetsFile)) {
                try {
                    execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                } catch (_) {}
            }
        }

        const env = OFFLINE_DOTNET_ENV;

        // Stage 1: Fast compilation via local .NET SDK (direct Roslyn or optimized dotnet build)
        const buildProcess = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env });
        activeProcess = buildProcess;

        let rawCompilerOutput = '';
        buildProcess.stdout.on('data', (d) => { rawCompilerOutput += d.toString(); });
        buildProcess.stderr.on('data', (d) => { rawCompilerOutput += d.toString(); });

        const buildTimeout = setTimeout(() => {
            if (activeProcess === buildProcess) {
                try { buildProcess.kill(); } catch (_) {}
                socket.emit('terminal_output', "\n[Compilation timed out]\n");
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
            }
        }, 15000);

        buildProcess.on('error', (err) => {
            clearTimeout(buildTimeout);
            socket.emit('terminal_output', `\n[Compiler launch error: ${err.message}]\n`);
            socket.emit('process_exit', { code: 1 });
            activeProcess = null;
        });

        buildProcess.on('close', (buildCode) => {
            clearTimeout(buildTimeout);
            if (activeProcess !== buildProcess) return;

            const diagnostics = parseCompilerDiagnostics(rawCompilerOutput);
            socket.emit('compiler_diagnostics', diagnostics);

            if (buildCode !== 0 || !fs.existsSync(dllPath)) {
                socket.emit('terminal_output', rawCompilerOutput + "\n[Build failed. Fix the build errors and run again.]\n");
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
                return;
            }

            // Stage 2: Direct .dll execution (sub-100ms startup, zero MSBuild wrapper overhead)
            socket.emit('terminal_output', "Running...\n\n");
            socket.emit('program_started');

            const runProcess = spawn('dotnet', [dllPath], { cwd: projectDir, env });
            activeProcess = runProcess;

            const executionTimeout = setTimeout(() => {
                if (activeProcess === runProcess) {
                    try { runProcess.kill(); } catch (_) {}
                    socket.emit('terminal_output', "\n[Process terminated: Execution limit of 20s exceeded]\n");
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                }
            }, 20000);

            runProcess.on('error', (err) => {
                clearTimeout(executionTimeout);
                socket.emit('terminal_output', `\n[Execution error: ${err.message}]\n`);
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
            });

            runProcess.stdout.on('data', (data) => {
                socket.emit('terminal_output', data.toString());
            });

            runProcess.stderr.on('data', (data) => {
                socket.emit('terminal_output', data.toString());
            });

            runProcess.on('close', (runCode) => {
                clearTimeout(executionTimeout);
                socket.emit('terminal_output', `\n[Process exited with code ${runCode ?? 0}]\n`);
                socket.emit('process_exit', { code: runCode ?? 0 });
                activeProcess = null;
            });
        });
    }

    socket.on('terminal_input', (input) => {
        if (activeProcess && activeProcess.stdin) {
            activeProcess.stdin.write(input + '\n');
        }
    });

    socket.on('stop_code', () => {
        if (activeProcess) {
            activeProcess.kill();
            socket.emit('terminal_output', "\n[Process stopped by user]\n");
            socket.emit('process_exit', { code: 0 });
            activeProcess = null;
        }
    });

    socket.on('run_test_cases', async (data) => {
        try {
            if (!socket.user) {
                authenticateSocket(socket, data?.token || socket.handshake.auth?.token, data?.user);
            }

            if (!socket.user && (data?.username === 'CompilerView' || data?.room === 'sandbox')) {
                socket.user = { id: 9999, name: 'CompilerView', role: 'Student' };
            }

        const { code, extraFiles = [], testCases = [], language } = data || {};
        if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
            const results = (testCases || []).map(tc => ({
                id: tc.id,
                status: 'error',
                passed: false,
                actualOutput: '',
                expectedOutput: tc.expectedOutput || '',
                error: `Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.`
            }));
            return socket.emit('test_cases_results', { results });
        }
        if (!Array.isArray(testCases) || testCases.length === 0) {
            return socket.emit('test_cases_results', { results: [] });
        }

        const studentKey = socket.user?.id
            ? `u_${socket.user.id}`
            : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

        let ws = sessionWorkspaces.get(studentKey);
        let projectDir = ws?.projectDir;
        if (!projectDir) {
            projectDir = path.join(os.tmpdir(), `verity_ws_${studentKey}`);
            ws = { projectDir, lastUsed: Date.now() };
            sessionWorkspaces.set(studentKey, ws);
        } else {
            ws.lastUsed = Date.now();
        }

        const projectFile = path.join(projectDir, 'verity_base.csproj');
        const targetFramework = getDotnetTargetFramework();
        const dllPath = path.join(projectDir, 'bin', 'Debug', targetFramework, 'verity_base.dll');

        let compileSuccess = true;
        let buildOutput = '';
        const env = OFFLINE_DOTNET_ENV;

        // Check if compilation is needed
        if (ws.lastCompiledCode === code && fs.existsSync(dllPath)) {
            // Skip compilation, code hasn't changed
            console.log(`[TestCases] Skipping compilation for ${studentKey} (cached)`);
            socket.emit('compiler_diagnostics', []); // clear old diags
        } else {
            console.log(`[TestCases] Compiling for ${studentKey}...`);
            // Ensure workspace directory exists
            try {
                await ensureBaseTemplate();
                if (!fs.existsSync(projectDir)) {
                    fs.mkdirSync(projectDir, { recursive: true });
                    fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                }
            } catch (e) {
                console.warn('Workspace prep failed for test cases:', e.message);
            }

            // Write student code to Program.cs
            fs.writeFileSync(path.join(projectDir, 'Program.cs'), code || '', 'utf8');

            // Write any additional .cs files (multi-file support)
            const extraNames = new Set();
            for (const ef of extraFiles) {
                if (!ef || !ef.name || !ef.code) continue;
                const safeName = ef.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                if (safeName.toLowerCase() === 'program.cs') continue;
                fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
                extraNames.add(safeName);
            }
            try {
                for (const f of fs.readdirSync(projectDir)) {
                    if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                        try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) {}
                    }
                }
            } catch (_) {}

            // Ensure nuget and obj assets exist
            const nugetFile = path.join(projectDir, 'nuget.config');
            try {
                if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                    fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                }
            } catch (_) {}

            const treatWarningsAsErrors = await getTreatWarningsAsErrors();
            const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);

            if (compilerConfig.mode === 'dotnet-build') {
                const assetsFile = path.join(projectDir, 'obj', 'project.assets.json');
                if (!fs.existsSync(assetsFile)) {
                    try {
                        execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                    } catch (_) {}
                }
            }

            compileSuccess = await new Promise((resolve) => {
                const bp = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env });
                bp.stdout.on('data', d => { buildOutput += d.toString(); });
                bp.stderr.on('data', d => { buildOutput += d.toString(); });
                const timeout = setTimeout(() => {
                    try { bp.kill(); } catch (_) {}
                    resolve(false);
                }, 15000);
                bp.on('close', code => {
                    clearTimeout(timeout);
                    const diags = parseCompilerDiagnostics(buildOutput);
                    socket.emit('compiler_diagnostics', diags);
                    resolve(code === 0 && fs.existsSync(dllPath));
                });
                bp.on('error', () => {
                    clearTimeout(timeout);
                    resolve(false);
                });
            });

            if (compileSuccess) {
                ws.lastCompiledCode = code;
            } else {
                ws.lastCompiledCode = null;
                const results = testCases.map(tc => ({
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: '',
                    expectedOutput: tc.expectedOutput || '',
                    error: buildOutput || 'Compilation failed. Please fix syntax or type errors in code.'
                }));
                return socket.emit('test_cases_results', { results });
            }
        }

        // Run all test cases in parallel
        const results = await Promise.all(testCases.map(tc => new Promise((resolve) => {
            let actual = '';
            let runError = '';
            let killed = false;
            const rp = spawn('dotnet', [dllPath], { cwd: projectDir, env });

            const execTimeout = setTimeout(() => {
                killed = true;
                try { rp.kill(); } catch (_) {}
                const result = {
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: actual.replace(/\r\n/g, '\n'),
                    expectedOutput: tc.expectedOutput || '',
                    error: 'Execution timed out (5s limit exceeded)'
                };
                socket.emit('test_case_result', result);
                resolve(result);
            }, 5000);

            if (tc.input !== undefined && tc.input !== null && tc.input !== '') {
                try {
                    const inStr = String(tc.input);
                    rp.stdin.write(inStr.endsWith('\n') ? inStr : inStr + '\n');
                } catch (_) {}
            }
            try { rp.stdin.end(); } catch (_) {}

            rp.stdout.on('data', d => { actual += d.toString(); });
            rp.stderr.on('data', d => { runError += d.toString(); });

            rp.on('close', () => {
                clearTimeout(execTimeout);
                if (killed) return;
                const normActual = actual.replace(/\r\n/g, '\n').trim();
                const normExpected = (tc.expectedOutput || '').replace(/\r\n/g, '\n').trim();
                const passed = normActual === normExpected;
                const result = {
                    id: tc.id,
                    status: passed ? 'passed' : 'failed',
                    passed,
                    actualOutput: actual.replace(/\r\n/g, '\n'),
                    expectedOutput: tc.expectedOutput || '',
                    error: runError || null
                };
                socket.emit('test_case_result', result);
                resolve(result);
            });

            rp.on('error', (err) => {
                clearTimeout(execTimeout);
                if (killed) return;
                const result = {
                    id: tc.id,
                    status: 'error',
                    passed: false,
                    actualOutput: actual.replace(/\r\n/g, '\n'),
                    expectedOutput: tc.expectedOutput || '',
                    error: err.message
                };
                socket.emit('test_case_result', result);
                resolve(result);
            });
        })));

        socket.emit('test_cases_results', { results });
        } catch (error) {
            console.error('Test case error:', error);
            socket.emit('test_cases_results', { results: [] });
        }
    });

    socket.on('student_typing', (data) => {
        if (data && data.studentId) {
            const classroomId = data.classroomId != null ? String(data.classroomId) : 'none';
            const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'none';
            const studentKey = `${classroomId}:${assignmentId}:${data.studentId}`;
            
            const existing = activeStudents[studentKey] || {};
            const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];

            // Merge any client-supplied logs
            let mergedLogs = existingLogs;
            if (Array.isArray(data.logs) && data.logs.length > 0) {
                const map = new Map();
                [...existingLogs, ...data.logs].forEach(l => {
                    if (!l) return;
                    const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
                    if (!map.has(k)) {
                        map.set(k, {
                            id: l.id || Date.now(),
                            action: l.action || l.message || 'Violation',
                            message: l.message || l.action || 'Violation',
                            time: l.time || '',
                            color: l.color || '#ef4444',
                            studentId: data.studentId,
                            studentName: data.name || data.studentId
                        });
                    }
                });
                mergedLogs = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
            }

            const updated = {
                ...existing,
                ...data,
                classroomId,
                assignmentId,
                logs: mergedLogs,
                status: existing.status === 'Submitted' || existing.status === 'Graded' ? existing.status : 'Live'
            };

            activeStudents[studentKey] = updated;
            socket.data.studentKey = studentKey;
            socket.data.studentId = data.studentId;

            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            socket.to(roomName).emit('teacher_update_code', updated);
        }
    });

    socket.on('proctor_alert', async (data) => {
        if (data && data.studentId) {
            const studentId = data.studentId;
            const studentName = data.name || studentId;
            let classroomId = data.classroomId != null ? String(data.classroomId) : null;
            let assignmentId = data.assignmentId != null ? String(data.assignmentId) : null;

            if (!classroomId || !assignmentId) {
                if (socket.data.studentKey) {
                    const parts = socket.data.studentKey.split(':');
                    if (parts.length >= 3) {
                        classroomId = classroomId || parts[0];
                        assignmentId = assignmentId || parts[1];
                    }
                } else {
                    const found = Object.values(activeStudents).find(s => 
                        s && (s.studentId === studentId || s.name === studentName)
                    );
                    if (found) {
                        classroomId = classroomId || found.classroomId;
                        assignmentId = assignmentId || found.assignmentId;
                    }
                }
            }
            classroomId = classroomId || 'none';
            assignmentId = assignmentId || 'none';

            const actionText = data.action || data.desc || 'Violation';
            const messageText = data.message || actionText;
            const timeText = data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            const colorVal = data.color || '#ef4444';

            const newLog = {
                id: data.id || Date.now(),
                action: actionText,
                message: messageText,
                time: timeText,
                color: colorVal,
                studentId,
                studentName
            };

            const studentKey = `${classroomId}:${assignmentId}:${studentId}`;
            const existing = activeStudents[studentKey] || {
                studentId,
                name: studentName,
                code: '',
                classroomId,
                assignmentId,
                logs: [],
                status: 'Live'
            };

            const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
            const isDup = existingLogs.some(l => l.action === newLog.action && (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000));
            const updatedLogs = isDup ? existingLogs : [newLog, ...existingLogs];

            activeStudents[studentKey] = {
                ...existing,
                studentId,
                name: studentName,
                classroomId,
                assignmentId,
                logs: updatedLogs,
                status: existing.status || 'Live'
            };

            if (studentName !== studentId) {
                const altKey = `${classroomId}:${assignmentId}:${studentName}`;
                if (activeStudents[altKey]) {
                    activeStudents[altKey].logs = updatedLogs;
                }
            }

            try {
                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    String(classroomId),
                    String(assignmentId),
                    String(studentId),
                    String(studentName),
                    actionText,
                    messageText,
                    timeText,
                    colorVal
                ).catch(() => {});
            } catch (_) {}

            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            socket.to(roomName).emit('teacher_receive_alert', {
                ...data,
                id: newLog.id,
                studentId,
                name: studentName,
                action: actionText,
                message: messageText,
                time: timeText,
                color: colorVal
            });
        }

        try {
            const key = todayKey();
            const actionStr = (data?.action || '').toLowerCase();
            const descStr = (data?.desc || '').toLowerCase();
            const isSystemExit = actionStr.includes('system exit') || descStr.includes('system exit') || descStr.includes('exited system') || descStr.includes('exited the system');
            const isExitTab = !isSystemExit && (actionStr.includes('tab') || actionStr.includes('exit') || actionStr.includes('blur') || descStr.includes('tab') || descStr.includes('blur'));
            const isCopyPaste = actionStr.includes('paste') || actionStr.includes('clipboard') || actionStr.includes('copy');
            const isAltTabCopyPaste = isExitTab || isCopyPaste;

            if (isAltTabCopyPaste) {
                // Count under Alt-Tab / Copy-Paste flags
                await db.run(
                    'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 0, 1) ON CONFLICT(date_string) DO UPDATE SET alt_tab_copy_paste_count = COALESCE(security_flags.alt_tab_copy_paste_count, 0) + 1',
                    key
                );
            } else {
                // Count under high-severity Security Flags Today (including System Exit Violation)
                await db.run(
                    'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1',
                    key
                );
            }

            const nowIso = new Date().toISOString();
            // Log event to audit_logs for admin activity view
            if (data && (data.studentId || data.name || data.email)) {
                const userName = data.name || data.email || data.studentId;
                
                let logType = 'Security Flag Alert';
                let logSeverity = 'High';
                
                if (isSystemExit) {
                    logType = 'System Exit Violation';
                    logSeverity = 'High';
                } else if (isCopyPaste) {
                    logType = 'Copy/Paste Violation';
                    logSeverity = 'High';
                } else if (isExitTab) {
                    logType = 'Exit Tab Violation';
                    logSeverity = 'Warning';
                }

                await db.run(
                    'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                    nowIso,
                    userName,
                    logType,
                    logSeverity,
                    data.desc || (data.classroomId ? `${data.action || 'Violation alert'} in classroom ${data.classroomId}` : (data.action || 'Violation alert'))
                );
            }

            // Emit live real-time update to all admin sessions
            io.emit('admin_security_alert', {
                ...data,
                isAltTabCopyPaste,
                isSystemExit,
                timestamp: nowIso
            });
            io.emit('admin_stats_update');
        } catch (e) { console.error(e); }
    });

    socket.on('submit_exam', async (data) => {
        if (!socket.user) return;
        const authenticatedName = socket.user.name || socket.user.email || 'Unknown';
        const authenticatedId = socket.user.id || data.studentId;
        const classroomId = data.classroomId || 'none';
        const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';
        const studentKey = `${classroomId}:${assignmentId}:${authenticatedId}`;
        
        const strictWarnings = await getTreatWarningsAsErrors();
        const payload = { 
            ...data, 
            studentName: authenticatedName, 
            studentId: authenticatedId,
            strictWarningsEnforced: strictWarnings
        };
        delete activeStudents[studentKey];
        delete activeStudents[`${classroomId}:${assignmentId}:${authenticatedName}`];
        delete activeStudents[`${classroomId}:${assignmentId}:${authenticatedId}`];

        const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
        socket.to(roomName).emit('teacher_receive_submission', payload);
        socket.to(roomName).emit('teacher_student_left', { studentId: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted' });

        try {
            await db.run('DELETE FROM submissions WHERE assignment_id = ? AND student_name = ?', assignmentId, authenticatedName);
            const historyStr = JSON.stringify(Array.isArray(data.codeHistory) ? data.codeHistory : []);
            await db.run('INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)', assignmentId, authenticatedName, historyStr, new Date().toISOString());
        } catch (e) { console.error(e); }
    });

    socket.on('unsubmit_exam', async (data) => {
        if (!socket.user || !data) return;
        const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';
        const studentName = socket.user.role === 'Student' 
            ? (socket.user.name || socket.user.email || 'Unknown')
            : (data.studentName || data.studentId || 'Unknown');
        const studentId = socket.user.role === 'Student' ? socket.user.id : data.studentId;
        const classroomId = data.classroomId || 'none';
        const studentKey = `${classroomId}:${assignmentId}:${studentId || studentName}`;

        if (activeStudents[studentKey]) {
            activeStudents[studentKey] = { ...activeStudents[studentKey], status: 'Active' };
        }

        try {
            await db.run(
                'DELETE FROM submissions WHERE assignment_id = ? AND (student_name = ? OR student_name = ? OR LOWER(student_name) = LOWER(?) OR LOWER(student_name) = LOWER(?))',
                assignmentId, studentName, studentName, studentName, studentName
            );
        } catch (e) { console.error(e); }

        const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
        socket.to(roomName).emit('teacher_student_unsubmitted', { studentName, assignmentId, studentId });
        socket.emit('student_unsubmitted', { studentName, assignmentId, studentId });
        socket.broadcast.emit('student_unsubmitted', { studentName, assignmentId, studentId });
    });

    socket.on('student_terminal_update', (data) => {
        socket.broadcast.emit('teacher_terminal_update', data);
    });

    socket.on('student_leave_workspace', () => {
        if (activeProcess) {
            activeProcess.kill();
            activeProcess = null;
        }
        if (socket.data.studentKey) {
            delete activeStudents[socket.data.studentKey];
            socket.broadcast.emit('teacher_student_left', { studentId: socket.data.studentId });
            socket.data.studentKey = null;
            socket.data.studentId = null;
        }
    });

    socket.on('disconnect', async () => {
        if (activeProcess) {
            try { activeProcess.kill(); } catch (_) {}
            activeProcess = null;
        }
        if (socket.data.studentKey) {
            delete activeStudents[socket.data.studentKey];
            socket.broadcast.emit('teacher_student_left', { studentId: socket.data.studentId });
        }

        // If a student disconnects, check if an exit log was already posted in the last 4 seconds
        if (socket.user && socket.user.role === 'Student') {
            const userName = socket.user.name || socket.user.email || 'Student';
            try {
                const recentWindow = new Date(Date.now() - 4000).toISOString();
                const recent = await db.get(
                    `SELECT id FROM audit_logs WHERE ("user" = ? OR "user" = ?) AND timestamp >= ? LIMIT 1`,
                    userName, socket.user.email || userName, recentWindow
                );
                if (!recent) {
                    const key = todayKey();
                    const nowIso = new Date().toISOString();
                    await db.run(
                        'INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1',
                        key
                    );
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso,
                        userName,
                        'System Exit Violation',
                        'High',
                        `Student exited the system: ${userName} closed or disconnected application (outside workspace)`
                    );
                    io.emit('admin_security_alert', {
                        user: userName,
                        name: userName,
                        studentId: socket.user.id || userName,
                        type: 'System Exit Violation',
                        desc: `Student exited the system: ${userName} closed or disconnected application`,
                        severity: 'High',
                        isAltTabCopyPaste: false,
                        isSystemExit: true,
                        timestamp: nowIso
                    });
                    io.emit('admin_stats_update');
                }
            } catch (_) {}
        }
    });
});

// --- AUDIT LOGS ---
app.get('/audit-logs/user/:identifier', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const id = decodeURIComponent(req.params.identifier);
        const logs = await db.all(
            `SELECT * FROM audit_logs WHERE LOWER("user") = LOWER(?) OR LOWER("user") = LOWER(?) ORDER BY id DESC LIMIT 200`,
            id, id
        );
        res.status(200).json({ logs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.get('/audit-logs', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300');
        res.status(200).json({ logs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/audit-logs', authenticateToken, async (req, res) => {
    try {
        const { user = 'System', type = 'Event', severity = 'Normal', desc = '' } = req.body || {};
        const timestamp = new Date().toISOString();
        await db.run(
            'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
            timestamp, user, type, severity, desc
        );

        if (severity === 'High' || severity === 'Warning') {
            const key = todayKey();
            const descLower = (desc || '').toLowerCase();
            const typeLower = (type || '').toLowerCase();
            const isSystemExit = typeLower.includes('system exit') || descLower.includes('system exit') || descLower.includes('exited system') || descLower.includes('exited the system');
            const isAltTabCopyPaste = !isSystemExit && (descLower.includes('tab') || descLower.includes('paste') || descLower.includes('clipboard') || descLower.includes('copy') || descLower.includes('exit tab') || typeLower.includes('alt-tab') || typeLower.includes('copy-paste'));

            if (isAltTabCopyPaste) {
                await db.run(
                    `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 0, 1) ON CONFLICT(date_string) DO UPDATE SET alt_tab_copy_paste_count = COALESCE(security_flags.alt_tab_copy_paste_count, 0) + 1`,
                    key
                );
            } else {
                await db.run(
                    `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
                    key
                );
            }

            // Emit live real-time update to all admin sessions
            io.emit('admin_security_alert', {
                user,
                name: user,
                studentId: user,
                type,
                desc,
                action: desc,
                isAltTabCopyPaste,
                isSystemExit,
                timestamp
            });
            io.emit('admin_stats_update');
        }

        res.status(201).json({ message: 'Log entry saved', timestamp });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- SYSTEM SETTINGS API ---
app.get('/system-settings', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all('SELECT key, value FROM system_settings');
        const settings = {};
        rows.forEach(r => {
            try { settings[r.key] = JSON.parse(r.value); }
            catch (e) { settings[r.key] = r.value; }
        });
        res.status(200).json({ settings });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

const handleSaveSettings = async (req, res) => {
    try {
        const { settings } = req.body || {};
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ message: 'Invalid settings object' });
        }
        for (const [key, val] of Object.entries(settings)) {
            const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
            await db.run('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, strVal);
        }
        io.emit('system_settings_updated', { settings });
        getKioskSettings().then(kioskConfig => {
            io.emit('kiosk_settings', kioskConfig);
        }).catch(() => {});
        const userName = req.user?.email || req.user?.name || 'unknown';
        await db.run('INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)', userName, 'System Settings Updated', 'Normal', 'Admin updated system settings via API');
        res.status(200).json({ message: 'Settings saved successfully' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

app.put('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);

// Backward compatibility: POST delegates to the same handler
app.post('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);

// --- ACCESS TOKENS API ---
app.get('/access-tokens', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const tokens = await db.all('SELECT * FROM access_tokens ORDER BY id DESC');
        res.status(200).json({ tokens });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/access-tokens', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const { studentName, classroom, count = 1 } = req.body || {};
        const generated = [];

        for (let i = 0; i < count; i++) {
            const randPart = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const tokenStr = `VRTY-EXAM-${randPart}`;
            const name = studentName || `Student ${i + 1}`;
            const cls = classroom || 'General Roster';
            const created = new Date().toISOString();
            await db.run('INSERT INTO access_tokens (token, student_name, classroom, created_at) VALUES (?, ?, ?, ?)', tokenStr, name, cls, created);
            generated.push({ token: tokenStr, student_name: name, classroom: cls, created_at: created });
        }
        res.status(201).json({ message: `${count} token(s) generated`, tokens: generated });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/access-tokens/:id', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        await db.run('DELETE FROM access_tokens WHERE id = ?', req.params.id);
        res.status(200).json({ message: 'Token deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ROSTER IMPORT API ---
app.post('/users/import', authenticateToken, requireRole('Admin'), async (req, res) => {
    try {
        const { users } = req.body || {};
        if (!Array.isArray(users)) return res.status(400).json({ message: 'users array required' });

        let added = 0;
        let skipped = 0;

        for (const u of users) {
            if (!u.email || !u.name) continue;
            const existing = await db.get('SELECT id FROM users WHERE email = ?', u.email);
            if (existing) {
                skipped++;
            } else {
                const pass = u.password || 'verity2026';
                const role = u.role || 'Student';
                const status = u.status || 'Active';
                await db.run('INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', u.name, u.email, pass, role, status);
                added++;
            }
        }

        res.status(200).json({ message: `Roster import complete: ${added} added, ${skipped} skipped (already exists).`, added, skipped });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- QUESTION BANK API ---
app.get('/question-bank', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM question_bank ORDER BY id DESC');
        const questions = rows.map(q => ({
            ...q,
            test_cases: JSON.parse(q.test_cases || '[]')
        }));
        res.status(200).json({ questions });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.post('/question-bank', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        const { id, title, description, starter_code, test_cases = [], points = 100 } = req.body || {};
        const tcStr = JSON.stringify(test_cases);

        if (id) {
            await db.run(
                'UPDATE question_bank SET title = ?, description = ?, starter_code = ?, test_cases = ?, points = ? WHERE id = ?',
                title, description, starter_code, tcStr, points, id
            );
            res.status(200).json({ message: 'Question updated' });
        } else {
            const info = await db.run(
                'INSERT INTO question_bank (title, description, starter_code, test_cases, points) VALUES (?, ?, ?, ?, ?)',
                title, description, starter_code, tcStr, points
            );
            res.status(201).json({ message: 'Question created', id: info.lastInsertRowid });
        }
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.delete('/question-bank/:id', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
    try {
        await db.run('DELETE FROM question_bank WHERE id = ?', req.params.id);
        res.status(200).json({ message: 'Question deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// START SERVER (deferred when loaded from Electron; auto-start when run directly)
async function reconcileDatabaseClassrooms() {
    try {
        const teachers = await db.all("SELECT id, name, email FROM users WHERE LOWER(role) = 'teacher' OR LOWER(role) = 'instructor'").catch(() => []);
        for (const t of (teachers || [])) {
            if (!t.name || !t.email) continue;
            await db.run(
                `UPDATE classrooms SET instructor_email = ? 
                 WHERE (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = TRIM(LOWER(?)))
                   AND (instructor_email IS NULL OR instructor_email = '' OR LOWER(instructor_email) != LOWER(?))`,
                t.email.trim().toLowerCase(), t.name.trim(), t.email.trim().toLowerCase()
            ).catch(() => {});
        }
    } catch (e) {
        console.warn('[reconcileDatabaseClassrooms] Warning during startup sync:', e.message);
    }
}

// --- COMLAB OFFLINE / LAN: SERVE FRONTEND BUNDLE IF PRESENT ---
const candidateDistDirs = [
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
    path.join(process.cwd(), 'dist'),
    process.resourcesPath ? path.join(process.resourcesPath, 'dist') : null
].filter(Boolean);

const frontendDistPath = candidateDistDirs.find(d => fs.existsSync(path.join(d, 'index.html')));

if (frontendDistPath) {
    app.use(express.static(frontendDistPath));
    app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        if (req.path.startsWith('/api') || 
            req.path.startsWith('/socket.io') || 
            req.path.startsWith('/uploads') || 
            req.path === '/health' ||
            req.path.includes('.')) {
            return next();
        }
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

function getLanIpAddresses() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

function start(port = process.env.PORT || 3001) {
    return new Promise((resolve) => {
        const p = parseInt(port, 10) || 3001;
        server.listen(p, '0.0.0.0', () => {
            const lanIps = getLanIpAddresses();
            console.log('\n========================================================');
            console.log('  🎓 THE VERITY - OFFLINE COMLAB / LAN SERVER READY');
            console.log('========================================================');
            console.log(`  Local Machine:     http://localhost:${p}`);
            if (lanIps.length > 0) {
                lanIps.forEach(ip => {
                    console.log(`  LAN (ComLab Web):  http://${ip}:${p}`);
                    console.log(`  LAN (Vite Dev):    http://${ip}:5173`);
                });
            }
            console.log('--------------------------------------------------------');
            console.log(`  📦 Database Provider: ${db.providerName}`);
            if (frontendDistPath) {
                console.log(`  🌐 Serving Web App:   ${frontendDistPath}`);
            }
            console.log('  🔒 100% Offline Capable: No external internet required');
            console.log('========================================================\n');
            reconcileDatabaseClassrooms().catch(() => {});
            resolve(p);
        });
    });
}

function stop() {
    return new Promise((resolve) => {
        io.close();
        server.close(() => resolve());
    });
}

// Run immediately when this file is executed directly (e.g. `node server/server.js`).
if (require.main === module) {
    const port = process.env.PORT || 3001;
    start(port);
}

module.exports = { start, stop, app };
// Watch reload trigger: 2026-10-17T09:38:00Z