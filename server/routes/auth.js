const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sendOtpEmail } = require('../utils/emailService');
const { hashPassword, verifyPassword, sanitizeUser } = require('../utils/passwordHash');
const { sendEmailDeliveryError, isAllowedCorsOrigin } = require('../utils/serverHelpers');

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CVSU_EMAIL_DOMAIN = '@cvsu.edu.ph';
const CVSU_EMAIL_ERROR_MSG = 'Access restricted: Only official @cvsu.edu.ph email accounts can register.';

function isValidCvsuEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    return EMAIL_FORMAT_REGEX.test(clean) && clean.endsWith(CVSU_EMAIL_DOMAIN);
}

/**
 * Registers OTP registration, standard/admin login, and Google SSO authentication routes.
 */
function registerAuthRoutes(app, { db, io, JWT_SECRET, authMiddleware, settingsService }) {
    const {
        adminLoginAttempts,
        otpAttemptCounts,
        checkOtpSendRateLimit,
        adminIpWhitelist,
        adminLoginRateLimiter,
        loginRateLimiter,
        authenticateToken,
        requireRole
    } = authMiddleware;
    const { validatePassword, getMaintenanceStatus, checkAndFlagMultipleLogins } = settingsService;

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '224892595118-lbmp59pc67u3e7968qhi78qdluvqt8kr.apps.googleusercontent.com';
    const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const ALLOWED_GOOGLE_AUDIENCES = [
        GOOGLE_CLIENT_ID,
        process.env.VITE_GOOGLE_CLIENT_ID,
        '224892595118-lbmp59pc67u3e7968qhi78qdluvqt8kr.apps.googleusercontent.com'
    ].filter(Boolean);

    const googleClient = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
    );

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
            const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
            if (!checkOtpSendRateLimit(`send-ip:${clientIp}`, 20) || !checkOtpSendRateLimit(`send:${cleanEmail}`)) {
                return res.status(429).json({ message: 'Too many OTP requests. Please wait before requesting another code.' });
            }

            if (!EMAIL_FORMAT_REGEX.test(cleanEmail)) {
                return res.status(400).json({ message: 'Please enter a valid email address' });
            }
            if (!isValidCvsuEmail(cleanEmail)) {
                return res.status(400).json({ message: CVSU_EMAIL_ERROR_MSG });
            }

            const passwordError = await validatePassword(password);
            if (passwordError) return res.status(400).json({ message: passwordError });

            const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
            const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
            if (existingUserEmail || existingAdminEmail) {
                return res.status(400).json({ message: 'Email is already in use' });
            }

            const otpCode = crypto.randomInt(100000, 1000000).toString();
            const expiresAt = Date.now() + 15 * 60 * 1000;
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

            const userData = JSON.stringify({
                name: trimmedName,
                email: cleanEmail,
                password: hashPassword(password),
                role: role === 'Teacher' ? 'Teacher' : 'Student'
            });

            await db.run(
                'INSERT INTO otp_verifications (email, otp_code, user_data, expires_at) VALUES (?, ?, ?, ?)',
                cleanEmail, otpCode, userData, expiresAt
            );

            const emailResult = await sendOtpEmail({ email: cleanEmail, name: trimmedName, otp: otpCode });
            if (!emailResult || !emailResult.success) {
                await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail).catch(() => { });
                return sendEmailDeliveryError(res, cleanEmail, emailResult);
            }

            res.status(200).json({
                message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
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

            if (!isValidCvsuEmail(cleanEmail)) {
                await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail).catch(() => { });
                return res.status(400).json({ message: CVSU_EMAIL_ERROR_MSG });
            }

            const record = await db.get(
                'SELECT * FROM otp_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
                cleanEmail
            );
            if (!record) {
                return res.status(400).json({ message: 'No verification code found for this email. Please request a new one.' });
            }

            const expiresAt = Number(record.expires_at || record.expiresat || 0);
            if (Date.now() > expiresAt) {
                await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
                return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
            }

            const otpAttemptKey = `otp_reg:${cleanEmail}`;
            const otpAttempts = (otpAttemptCounts.get(otpAttemptKey) || 0) + 1;
            if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
                otpAttemptCounts.set(otpAttemptKey, otpAttempts);
                if (otpAttempts >= 5) {
                    otpAttemptCounts.delete(otpAttemptKey);
                    await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
                    return res.status(429).json({ message: 'Too many invalid verification attempts. Please request a new code.' });
                }
                return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
            }
            otpAttemptCounts.delete(otpAttemptKey);

            let userData;
            try {
                userData = JSON.parse(record.user_data || record.userdata);
            } catch {
                return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
            }

            const { name, password, role } = userData;
            const storedPassword = password && String(password).startsWith('scrypt$') ? password : hashPassword(String(password || ''));

            const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
            const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
            if (existingUser || existingAdmin) {
                await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);
                return res.status(400).json({ message: 'Email is already registered. Please log in.' });
            }

            const userRole = (role === 'Teacher') ? 'Teacher' : 'Student';
            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) requireApproval = false;
                }
            } catch (_) { }

            const status = (userRole === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
            const info = await db.run(
                'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
                name, cleanEmail, storedPassword, userRole, status
            );
            await db.clearSyncDeletion('users', cleanEmail).catch(() => { });
            try { db.triggerSync(); } catch (_) { }
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail);

            const user = sanitizeUser({ id: info.lastInsertRowid, name, email: cleanEmail, role: userRole, status });
            const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

            try {
                io.to('role:admin').emit('users_updated');
                io.to('role:admin').emit('admin_security_alert');
                io.to('role:admin').emit('admin_stats_update');
            } catch (_) { }

            try {
                const nowIso = new Date().toISOString();
                if (userRole === 'Teacher') {
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                        status === 'Pending' ? `New instructor account registered and pending admin approval (${cleanEmail})` : `New instructor account registered (${cleanEmail})`
                    ).catch(() => { });
                } else {
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name, 'User Registration', 'Normal', `New student account registered (${cleanEmail})`
                    ).catch(() => { });
                }
            } catch (_) { }

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
            if (!email) return res.status(400).json({ message: 'Email is required' });

            const cleanEmail = email.trim().toLowerCase();
            if (!isValidCvsuEmail(cleanEmail)) {
                return res.status(400).json({ message: CVSU_EMAIL_ERROR_MSG });
            }
            const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
            if (!checkOtpSendRateLimit(`send-ip:${clientIp}`, 20) || !checkOtpSendRateLimit(`send:${cleanEmail}`)) {
                return res.status(429).json({ message: 'Too many OTP resend requests. Please wait before trying again.' });
            }

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
            await db.run('UPDATE otp_verifications SET otp_code = ?, expires_at = ? WHERE id = ?', otpCode, expiresAt, record.id);

            const emailResult = await sendOtpEmail({
                email: cleanEmail,
                name: (userData && userData.name) || 'User',
                otp: otpCode
            });

            if (!emailResult || !emailResult.success) {
                return sendEmailDeliveryError(res, cleanEmail, emailResult);
            }

            res.status(200).json({ message: `A new 6-digit verification code has been sent to ${cleanEmail}.` });
        } catch (e) {
            res.status(500).json({ message: e.message || 'Failed to resend code' });
        }
    });

    app.post('/register', authenticateToken, requireRole('Admin'), async (req, res) => {
        try {
            const maintenance = await getMaintenanceStatus();
            if (maintenance.enabled && req.user?.role !== 'Admin') {
                return res.status(503).json({ message: maintenance.message, maintenance: true });
            }

            const { name, email, password, role } = req.body;
            if (!email || !password || !name) {
                return res.status(400).json({ message: 'Name, email, and password are required' });
            }

            const cleanEmail = (email || '').trim().toLowerCase();
            const passwordError = await validatePassword(password);
            if (passwordError) return res.status(400).json({ message: passwordError });

            const existingUserEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', cleanEmail);
            const existingAdminEmail = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
            if (existingUserEmail || existingAdminEmail) {
                return res.status(400).json({ message: 'Email is already in use' });
            }

            const requesterIsAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
            let userRole = 'Student';
            let status = 'Active';

            let requireApproval = true;
            try {
                const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                if (row) {
                    const config = JSON.parse(row.value);
                    if (config?.roles?.requireAdminApproval === false) requireApproval = false;
                }
            } catch (_) { }

            if (requesterIsAdmin && role === 'Admin') {
                userRole = 'Admin';
            } else if (role === 'Teacher') {
                userRole = 'Teacher';
                status = requesterIsAdmin || !requireApproval ? 'Active' : 'Pending';
            }

            const hashedPassword = hashPassword(String(password));
            const info = await db.run(
                'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
                name, cleanEmail, hashedPassword, userRole, status
            );
            await db.clearSyncDeletion('users', cleanEmail).catch(() => { });
            try { db.triggerSync(); } catch (_) { }

            const user = sanitizeUser({ id: info.lastInsertRowid, name, email: cleanEmail, role: userRole, status });
            const userToken = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

            try {
                io.to('role:admin').emit('users_updated');
                io.to('role:admin').emit('admin_security_alert');
                io.to('role:admin').emit('admin_stats_update');
            } catch (_) { }

            try {
                const nowIso = new Date().toISOString();
                if (userRole === 'Teacher') {
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name, 'Teacher Registration', status === 'Pending' ? 'Warning' : 'Normal',
                        status === 'Pending' ? `New instructor account registered and pending admin approval (${email})` : `New instructor account registered (${email})`
                    ).catch(() => { });
                } else if (userRole === 'Student') {
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name, 'User Registration', 'Normal', `New student account registered (${email})`
                    ).catch(() => { });
                }
            } catch (_) { }

            res.status(201).json({ message: 'User registered successfully', user, token: userToken });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.post('/login', loginRateLimiter, async (req, res) => {
        try {
            const maintenance = await getMaintenanceStatus();
            if (maintenance.enabled) {
                return res.status(503).json({ message: maintenance.message, maintenance: true });
            }

            const { email, password } = req.body;
            const rawIdentifier = (email || req.body.username || req.body.identifier || '').trim();
            const cleanIdentifier = rawIdentifier.toLowerCase();
            const rawPassword = password !== undefined ? String(password) : '';
            const cleanPassword = rawPassword.trim();
            const safeLocalPart = !cleanIdentifier.includes('@') && /^[a-z0-9._+-]+$/i.test(cleanIdentifier);
            const emailLike = safeLocalPart ? `${cleanIdentifier}@%` : '';

            if (!cleanIdentifier) {
                return res.status(400).json({ message: 'Username or email is required' });
            }

            const isAdminAcc = await db.get(
                `SELECT id, email, name FROM admin_users WHERE LOWER(email) = ? OR LOWER(name) = ? OR (? != '' AND LOWER(email) LIKE ?)`,
                cleanIdentifier, cleanIdentifier, emailLike, emailLike
            );
            if (isAdminAcc && (
                String(isAdminAcc.email || '').toLowerCase() === cleanIdentifier ||
                String(isAdminAcc.name || '').toLowerCase() === cleanIdentifier ||
                (safeLocalPart && String(isAdminAcc.email || '').split('@')[0].toLowerCase() === cleanIdentifier)
            )) {
                req.loginRateMeta?.recordFailure();
                return res.status(401).json({ message: 'Invalid credentials. No account found with this email or username.' });
            }

            const userCandidate = await db.get(
                `SELECT * FROM users 
                 WHERE LOWER(email) = ? OR LOWER(name) = ? OR (? != '' AND LOWER(email) LIKE ?) 
                 ORDER BY CASE WHEN LOWER(email) = ? THEN 1 WHEN LOWER(name) = ? THEN 2 ELSE 3 END LIMIT 1`,
                cleanIdentifier, cleanIdentifier, emailLike, emailLike, cleanIdentifier, cleanIdentifier
            );
            const userExists = userCandidate && (
                String(userCandidate.email || '').toLowerCase() === cleanIdentifier ||
                String(userCandidate.name || '').toLowerCase() === cleanIdentifier ||
                (safeLocalPart && String(userCandidate.email || '').split('@')[0].toLowerCase() === cleanIdentifier)
            ) ? userCandidate : null;
            if (!userExists) {
                req.loginRateMeta?.recordFailure();
                return res.status(401).json({ message: 'Invalid credentials. No account found with this username or email address.' });
            }

            let user = null;
            if (userExists.password === 'google_sso_user') {
                req.loginRateMeta?.recordFailure();
                return res.status(401).json({ message: 'This account uses Google Sign-In. Please sign in with Google.' });
            } else {
                const check = verifyPassword(rawPassword, userExists.password);
                if (!check.valid) {
                    req.loginRateMeta?.recordFailure();
                    return res.status(401).json({ message: 'Invalid credentials. Please verify your password.' });
                }
                user = userExists;
                if (check.needsUpgrade) {
                    const upgradedHash = hashPassword(cleanPassword || rawPassword);
                    await db.run('UPDATE users SET password = ? WHERE id = ?', upgradedHash, userExists.id).catch(() => { });
                    userExists.password = upgradedHash;
                }
            }

            if (user.role === 'Admin' || user.role === 'admin') {
                try { await db.run('DELETE FROM users WHERE id = ?', user.id); } catch (_) { }
                req.loginRateMeta?.recordFailure();
                return res.status(401).json({ message: 'Invalid credentials. No account found with this email address.' });
            }
            if (user.status === 'Pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval' });
            }
            if (user.status === 'Disabled' || user.status === 'Suspended') {
                return res.status(403).json({ message: `Your account is ${String(user.status).toLowerCase()}. Please contact an administrator.` });
            }

            req.loginRateMeta?.clearSuccess();
            user.lastLogin = new Date().toISOString();
            db.run('UPDATE users SET lastLogin = ? WHERE id = ?', user.lastLogin, user.id).catch(() => { });
            checkAndFlagMultipleLogins(user, req).catch(() => { });

            const safeUser = sanitizeUser(user);
            const token = jwt.sign({ id: safeUser.id, email: safeUser.email, role: safeUser.role, name: safeUser.name }, JWT_SECRET, { expiresIn: '7d' });
            res.status(200).json({ message: 'Login successful', user: safeUser, token });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.post('/admin/login', adminIpWhitelist, adminLoginRateLimiter, async (req, res) => {
        try {
            const { email, password } = req.body;
            const rawIdentifier = (email || req.body.username || req.body.identifier || '').trim();
            const cleanIdentifier = rawIdentifier.toLowerCase();
            const rawPassword = password !== undefined ? String(password) : '';
            const cleanPassword = rawPassword.trim();
            const safeLocalPart = !cleanIdentifier.includes('@') && /^[a-z0-9._+-]+$/i.test(cleanIdentifier);
            const emailLike = safeLocalPart ? `${cleanIdentifier}@%` : '';

            if (!cleanIdentifier || !rawPassword) {
                return res.status(400).json({ message: 'Username/Email and password are required' });
            }

            const rawAdminCandidate = await db.get(
                `SELECT * FROM admin_users 
                 WHERE (LOWER(email) = ? OR LOWER(name) = ? OR (? != '' AND LOWER(email) LIKE ?))
                 ORDER BY CASE WHEN LOWER(email) = ? THEN 1 WHEN LOWER(name) = ? THEN 2 ELSE 3 END LIMIT 1`,
                cleanIdentifier, cleanIdentifier, emailLike, emailLike, cleanIdentifier, cleanIdentifier
            );
            const adminCandidate = rawAdminCandidate && (
                String(rawAdminCandidate.email || '').toLowerCase() === cleanIdentifier ||
                String(rawAdminCandidate.name || '').toLowerCase() === cleanIdentifier ||
                (safeLocalPart && String(rawAdminCandidate.email || '').split('@')[0].toLowerCase() === cleanIdentifier)
            ) ? rawAdminCandidate : null;

            const passCheck = adminCandidate ? verifyPassword(rawPassword, adminCandidate.password) : { valid: false, needsUpgrade: false };
            const adminUser = passCheck.valid ? adminCandidate : null;

            if (!adminUser) {
                if (req.adminRateRecord) {
                    req.adminRateRecord.count += 1;
                    adminLoginAttempts.set(req.clientIp, req.adminRateRecord);
                }
                return res.status(401).json({ message: 'Invalid admin credentials' });
            }

            if (passCheck.needsUpgrade) {
                const upgradedAdminPass = hashPassword(cleanPassword || rawPassword);
                await db.run('UPDATE admin_users SET password = ? WHERE id = ?', upgradedAdminPass, adminUser.id).catch(() => { });
            }

            if (adminUser.status === 'Suspended') {
                return res.status(403).json({ message: 'Admin account is suspended' });
            }

            if (req.clientIp) adminLoginAttempts.delete(req.clientIp);

            adminUser.lastLogin = new Date().toISOString();
            await db.run('UPDATE admin_users SET lastLogin = ? WHERE id = ?', adminUser.lastLogin, adminUser.id);

            const token = jwt.sign(
                { id: adminUser.id, email: adminUser.email, role: 'Admin', name: adminUser.name, isAdmin: true },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(200).json({
                message: 'Admin login successful',
                user: {
                    id: adminUser.id,
                    name: adminUser.name,
                    email: adminUser.email,
                    role: 'Admin',
                    status: adminUser.status || 'Active',
                    lastLogin: adminUser.lastLogin,
                    avatar: adminUser.avatar || null
                },
                token
            });
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

    app.get('/auth/google/external', (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId) return res.status(400).send('Missing sessionId');
        const emitGoogleRoom = (event, data) => {
            if (sessionId) io.to(`google-auth:${sessionId}`).emit(event, data);
        };
        if (!GOOGLE_CLIENT_SECRET) {
            emitGoogleRoom(`google-login-error-${sessionId}`, { message: 'Google Sign-In requires the online Cloud server.' });
            return res.status(503).send('<h2>Google Sign-In Unavailable Locally</h2><p>Google Sign-In requires an active connection to the online Cloud server, or sign in with email and password.</p>');
        }
        const requestedRole = req.query.role === 'Teacher' ? 'Teacher' : 'Student';
        const initialPass = (req.query.initialPassword && typeof req.query.initialPassword === 'string') ? req.query.initialPassword : '';
        const rawOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
        let openerOrigin = '';
        if (/^https?:\/\//i.test(rawOrigin) && isAllowedCorsOrigin(rawOrigin)) {
            try { openerOrigin = new URL(rawOrigin).origin; } catch (_) { openerOrigin = ''; }
        }
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const protocol = isLocal ? (req.protocol || 'http') : (req.headers['x-forwarded-proto'] || 'https');
        const redirectUri = `${protocol}://${host}/auth/google/callback`;
        const statePayload = Buffer.from(JSON.stringify({ sessionId, role: requestedRole, pass: initialPass, openerOrigin })).toString('base64url');
        const authorizeUrl = googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['email', 'profile'],
            state: statePayload,
            redirect_uri: redirectUri,
            hd: 'cvsu.edu.ph',
            prompt: 'select_account'
        });
        res.redirect(authorizeUrl);
    });

    app.get('/auth/google/callback', async (req, res) => {
        const { code, state } = req.query;
        if (!code || !state) return res.status(400).send('Missing code or state');
        if (!GOOGLE_CLIENT_SECRET) {
            return res.status(503).send('<h2>Google Sign-In Unavailable Locally</h2><p>Google Sign-In requires the online Cloud server.</p>');
        }

        let sessionId = '';
        let requestedRole = 'Student';
        let initialPass = '';
        let openerOrigin = '';
        try {
            const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
            sessionId = parsed.sessionId || '';
            requestedRole = parsed.role === 'Teacher' ? 'Teacher' : 'Student';
            initialPass = parsed.pass || '';
            if (typeof parsed.openerOrigin === 'string' && /^https?:\/\//i.test(parsed.openerOrigin) && isAllowedCorsOrigin(parsed.openerOrigin)) {
                openerOrigin = new URL(parsed.openerOrigin).origin;
            }
        } catch (_) {
            const stateParts = String(state).split(':');
            sessionId = stateParts[0];
            requestedRole = stateParts[1] === 'Teacher' ? 'Teacher' : 'Student';
        }

        const emitGoogleRoom = (targetSessionId, event, data) => {
            if (targetSessionId) io.to(`google-auth:${targetSessionId}`).emit(event, data);
        };

        try {
            const host = req.headers['x-forwarded-host'] || req.get('host');
            const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
            const protocol = isLocal ? (req.protocol || 'http') : (req.headers['x-forwarded-proto'] || 'https');
            const redirectUri = `${protocol}://${host}/auth/google/callback`;
            const { tokens } = await googleClient.getToken({ code, redirect_uri: redirectUri });

            const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: ALLOWED_GOOGLE_AUDIENCES });
            const payload = ticket.getPayload();
            const cleanEmail = (payload.email || '').trim().toLowerCase();
            const name = payload.name;

            if (!cleanEmail.endsWith('@cvsu.edu.ph')) {
                emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: 'Access restricted: Only official @cvsu.edu.ph Google accounts can register or sign in.' });
                return res.status(403).send(`
                    <html>
                        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; margin: 0; padding: 20px;">
                            <div style="text-align: center; max-width: 460px; background: #262626; padding: 36px 30px; border-radius: 16px; border: 1px solid #ef4444; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                <h2 style="color: #ef4444; margin-top: 0; margin-bottom: 12px;">Access Restricted</h2>
                                <p style="color: #e5e7eb; font-size: 1rem; line-height: 1.5; margin-bottom: 12px;">
                                    Only official <strong>@cvsu.edu.ph</strong> Google accounts are authorized to register or sign in to The Verity.
                                </p>
                                <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 24px; word-break: break-all;">
                                    Attempted email: <em>${cleanEmail}</em>
                                </p>
                                <button onclick="window.close()" style="background: #374151; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close Window</button>
                            </div>
                        </body>
                    </html>
                `);
            }

            const maintenance = await getMaintenanceStatus();
            if (maintenance.enabled) {
                emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: maintenance.message });
                return res.send(`<h2>System Maintenance</h2><p>${maintenance.message}</p>`);
            }

            const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
            if (isAdminAcc) {
                emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: 'Invalid credentials. No account found with this email address.' });
                return res.send('<h2>Error</h2><p>Invalid credentials. No account found with this email address.</p>');
            }

            let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);
            if (user) {
                if (user.status === 'Pending') {
                    emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: 'Your account is pending admin approval' });
                    return res.send('<h2>Account Pending</h2><p>Your account is pending admin approval.</p>');
                }
                if (user.status === 'Disabled' || user.status === 'Suspended') {
                    emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: `Your account is ${String(user.status).toLowerCase()}. Please contact an administrator.` });
                    return res.send(`<h2>Account ${user.status}</h2><p>Your account is ${String(user.status).toLowerCase()}.</p>`);
                }
                if (user.password === 'google_sso_user' && initialPass && initialPass.trim()) {
                    user.password = hashPassword(initialPass.trim());
                    await db.run('UPDATE users SET password = ? WHERE id = ?', user.password, user.id);
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
                } catch (_) { }

                const role = requestedRole;
                const status = (role === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
                const lastLogin = new Date().toISOString();
                const password = (initialPass && initialPass.trim()) ? hashPassword(initialPass.trim()) : 'google_sso_user';

                const info = await db.run(
                    'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                    name || 'Google User', cleanEmail, password, role, lastLogin, status
                );
                await db.clearSyncDeletion('users', cleanEmail).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
                user = { id: info.lastInsertRowid, name: name || 'Google User', email: cleanEmail, role, status, lastLogin };

                try {
                    const nowIso = new Date().toISOString();
                    const auditAction = role === 'Teacher'
                        ? (status === 'Pending' ? `New instructor account registered via Google and pending admin approval (${cleanEmail})` : `New instructor account registered via Google (${cleanEmail})`)
                        : `New student account registered via Google (${cleanEmail})`;
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name || cleanEmail, 'User Registration', 'Normal', auditAction
                    );
                } catch (auditErr) {
                    console.error('[Google SSO Callback] Failed to record registration audit log:', auditErr);
                }

                if (status === 'Pending') {
                    emitGoogleRoom(sessionId, `google-login-error-${sessionId}`, { message: 'Your instructor account has been created and is pending administrator approval.' });
                    return res.send(`
                        <html>
                            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; margin: 0; padding: 20px;">
                                <div style="text-align: center; max-width: 460px; background: #262626; padding: 36px 30px; border-radius: 16px; border: 1px solid #f59e0b;">
                                    <h2 style="color: #f59e0b; margin-top: 0; margin-bottom: 12px;">Account Pending Approval</h2>
                                    <p style="color: #e5e7eb; font-size: 1rem; line-height: 1.5; margin-bottom: 24px;">
                                        Your instructor account has been created and is waiting for administrator approval before you can sign in.
                                    </p>
                                    <button onclick="window.close()" style="background: #374151; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">Close Window</button>
                                </div>
                            </body>
                        </html>
                    `);
                }
            }

            const safeUser = sanitizeUser(user);
            const token = jwt.sign({ id: safeUser.id, email: safeUser.email, role: safeUser.role, name: safeUser.name }, JWT_SECRET, { expiresIn: '7d' });
            emitGoogleRoom(sessionId, `google-login-success-${sessionId}`, { user: safeUser, token });
            const safePayload = JSON.stringify({
                type: 'verity-google-auth-success', sessionId, user: safeUser, token
            }).replace(/</g, '\\u003c');
            const targetOrigin = openerOrigin || `${protocol}://${host}`;
            const safeTargetOrigin = JSON.stringify(targetOrigin).replace(/</g, '\\u003c');

            res.send(`
                <html>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white;">
                        <div style="text-align: center;">
                            <h2 style="color: #10b981;">Authentication Successful!</h2>
                            <p>You can safely close this window and return to The Verity app.</p>
                            <script>
                                try {
                                    if (window.opener && !window.opener.closed) {
                                        window.opener.postMessage(${safePayload}, ${safeTargetOrigin});
                                    }
                                } catch (e) {}
                                setTimeout(() => window.close(), 1200);
                            </script>
                        </div>
                    </body>
                </html>
            `);
        } catch (err) {
            console.error('Google OAuth Callback Error:', err);
            const sessionToNotify = sessionId || (req.query?.state || '').split(':')[0];
            if (sessionToNotify) emitGoogleRoom(sessionToNotify, `google-login-error-${sessionToNotify}`, { message: 'Google authentication failed' });
            res.status(500).send('<h2>Authentication Failed</h2><p>An error occurred during Google sign-in. Please try again.</p>');
        }
    });

    app.post('/auth/google', async (req, res) => {
        const { token, access_token, role: userRole } = req.body;
        try {
            const maintenance = await getMaintenanceStatus();
            if (maintenance.enabled) {
                return res.status(503).json({ message: maintenance.message, maintenance: true });
            }

            let email, name;
            if (access_token) {
                const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access_token)}`);
                if (!tokenInfoRes.ok) return res.status(401).json({ message: 'Invalid Google token' });
                const tokenInfo = await tokenInfoRes.json();
                const tokenAud = tokenInfo?.aud || tokenInfo?.azp || '';
                if (!ALLOWED_GOOGLE_AUDIENCES.includes(tokenAud)) {
                    return res.status(401).json({ message: 'Google token audience mismatch' });
                }
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                if (!userInfoRes.ok) return res.status(401).json({ message: 'Invalid Google token' });
                const userInfo = await userInfoRes.json();
                email = userInfo.email;
                name = userInfo.name;
            } else {
                const ticket = await googleClient.verifyIdToken({ idToken: token, audience: ALLOWED_GOOGLE_AUDIENCES });
                const payload = ticket.getPayload();
                email = payload.email;
                name = payload.name;
            }

            const cleanEmail = (email || '').trim().toLowerCase();
            if (!cleanEmail.endsWith('@cvsu.edu.ph')) {
                return res.status(403).json({
                    message: 'Access restricted: Only official @cvsu.edu.ph Google accounts can register or sign in.'
                });
            }

            const isAdminAcc = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ?', cleanEmail);
            if (isAdminAcc) {
                return res.status(401).json({ message: 'Invalid credentials. No account found with this email address.' });
            }

            const initialPass = (req.body.password && typeof req.body.password === 'string') ? req.body.password.trim() : '';
            let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', cleanEmail);

            if (user) {
                if (user.status === 'Pending') {
                    return res.status(403).json({ message: 'Your account is pending admin approval' });
                }
                if (user.password === 'google_sso_user' && initialPass) {
                    user.password = hashPassword(initialPass);
                    await db.run('UPDATE users SET password = ? WHERE id = ?', user.password, user.id);
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
                } catch (_) { }

                const role = (userRole === 'Teacher') ? 'Teacher' : 'Student';
                const status = (role === 'Teacher' && requireApproval) ? 'Pending' : 'Active';
                const lastLogin = new Date().toISOString();
                const password = initialPass ? hashPassword(initialPass) : 'google_sso_user';

                const info = await db.run(
                    'INSERT INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)',
                    name || 'Google User', cleanEmail, password, role, lastLogin, status
                );
                await db.clearSyncDeletion('users', cleanEmail).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
                user = { id: info.lastInsertRowid, name: name || 'Google User', email: cleanEmail, role, lastLogin, status };

                try {
                    const nowIso = new Date().toISOString();
                    const auditAction = role === 'Teacher'
                        ? (status === 'Pending' ? `New instructor account registered via Google and pending admin approval (${cleanEmail})` : `New instructor account registered via Google (${cleanEmail})`)
                        : `New student account registered via Google (${cleanEmail})`;
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name || cleanEmail, 'User Registration', 'Normal', auditAction
                    );
                } catch (auditErr) {
                    console.error('[Google SSO] Failed to record registration audit log:', auditErr);
                }

                if (status === 'Pending') {
                    return res.status(403).json({ message: 'Your instructor account has been created and is pending administrator approval.', user: sanitizeUser(user) });
                }
            }

            const safeUser = sanitizeUser(user);
            res.status(200).json({
                message: 'Google login successful',
                user: safeUser,
                token: jwt.sign({ id: safeUser.id, email: safeUser.email, role: safeUser.role, name: safeUser.name }, JWT_SECRET, { expiresIn: '7d' })
            });
        } catch (error) {
            console.error('Google Auth Error:', error);
            res.status(401).json({ message: 'Invalid Google token' });
        }
    });
}

module.exports = { registerAuthRoutes };
