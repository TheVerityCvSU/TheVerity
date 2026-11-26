const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/emailService');
const { hashPassword, verifyPassword, sanitizeUser } = require('../utils/passwordHash');
const { sendEmailDeliveryError } = require('../utils/serverHelpers');

/**
 * Registers user directory management, profile updates, OTP email changes,
 * password changes, and CSV roster import routes.
 */
function registerUserRoutes(app, { db, io, JWT_SECRET, authMiddleware, settingsService, classroomHelpers, studentNotificationService }) {
    const { otpAttemptCounts, authenticateToken, requireRole } = authMiddleware;
    const { validatePassword } = settingsService;
    const { syncUserEmailAcrossData } = classroomHelpers;

    app.get('/users', authenticateToken, requireRole('Admin'), async (req, res) => {
        try {
            const users = await db.all('SELECT id, name, email, role, lastLogin, status FROM users ORDER BY id ASC');
            let recentLogs = [];
            try {
                recentLogs = await db.all('SELECT id, "user", timestamp, "desc" FROM audit_logs ORDER BY id DESC LIMIT 500');
            } catch (_) { }

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

    app.get('/users/profile', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const userEmail = (req.user.email || '').trim().toLowerCase();
            let user = null;
            if (userEmail) {
                user = await db.get('SELECT id, name, email, role, avatar, status FROM users WHERE LOWER(email) = ?', userEmail);
                if (!user && req.user.role === 'Admin') {
                    user = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE LOWER(email) = ?', userEmail);
                }
            }
            if (!user && userId != null) {
                const byId = await db.get('SELECT id, name, email, role, avatar, status FROM users WHERE id = ?', userId);
                if (byId && (!userEmail || (byId.email || '').trim().toLowerCase() === userEmail)) {
                    user = byId;
                }
                if (!user && req.user.role === 'Admin') {
                    const adminById = await db.get('SELECT id, name, email, role, avatar, status, lastLogin FROM admin_users WHERE id = ?', userId);
                    if (adminById && (!userEmail || (adminById.email || '').trim().toLowerCase() === userEmail)) {
                        user = adminById;
                    }
                }
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
            const userEmail = (req.user.email || '').trim().toLowerCase();
            let current = null;
            let isAdmin = false;
            if (userEmail) {
                current = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', userEmail);
                if (!current && req.user.role === 'Admin') {
                    current = await db.get('SELECT * FROM admin_users WHERE LOWER(email) = ?', userEmail);
                    if (current) isAdmin = true;
                }
            }
            if (!current && userId != null) {
                const byId = await db.get('SELECT * FROM users WHERE id = ?', userId);
                if (byId && (!userEmail || (byId.email || '').trim().toLowerCase() === userEmail)) {
                    current = byId;
                }
                if (!current && req.user.role === 'Admin') {
                    const adminById = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
                    if (adminById && (!userEmail || (adminById.email || '').trim().toLowerCase() === userEmail)) {
                        current = adminById;
                        isAdmin = true;
                    }
                }
            }
            if (!current) return res.status(404).json({ message: 'User not found' });

            const targetUserId = current.id;
            const updatedName = name && name.trim() ? name.trim() : current.name;
            const updatedEmail = current.email;
            const updatedAvatar = avatar !== undefined ? avatar : current.avatar;

            if (isAdmin) {
                await db.run('UPDATE admin_users SET name = ?, avatar = ? WHERE id = ?', updatedName, updatedAvatar, targetUserId);
            } else {
                await db.run('UPDATE users SET name = ?, avatar = ? WHERE id = ?', updatedName, updatedAvatar, targetUserId);

                if (current.role === 'Teacher') {
                    await db.run(
                        'UPDATE classrooms SET instructor = ? WHERE LOWER(instructor_email) = LOWER(?) OR instructor = ?',
                        updatedName, current.email, current.name
                    ).catch(() => { });
                } else if (current.role === 'Student' && updatedName !== current.name) {
                    await db.run(
                        'UPDATE enrollments SET student_name = ? WHERE LOWER(student_email) = LOWER(?) OR student_id = ?',
                        updatedName, current.email, targetUserId
                    ).catch(() => { });
                    await db.run(
                        'UPDATE submissions SET student_name = ? WHERE LOWER(TRIM(student_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(student_name)) = LOWER(TRIM(?))',
                        updatedName, current.name, current.email
                    ).catch(() => { });
                }
            }

            const user = {
                id: targetUserId,
                name: updatedName,
                email: updatedEmail,
                role: current.role,
                avatar: updatedAvatar,
                status: current.status
            };

            io.emit('user_avatar_updated', {
                userId: targetUserId,
                name: updatedName,
                email: updatedEmail,
                avatar: updatedAvatar,
                role: current.role
            });
            if (current.role === 'Teacher') io.emit('classrooms_updated');

            res.status(200).json({ message: 'Profile updated successfully', user });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/users/notification-preferences', authenticateToken, async (req, res) => {
        try {
            if (!studentNotificationService) {
                return res.status(503).json({ message: 'Notification preferences service unavailable' });
            }
            const email = (req.user?.email || '').trim().toLowerCase();
            if (!email) return res.status(400).json({ message: 'User email not found' });
            const preferences = await studentNotificationService.getStudentNotificationPreferences(email);
            res.status(200).json({ preferences });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.put('/users/notification-preferences', authenticateToken, async (req, res) => {
        try {
            if (!studentNotificationService) {
                return res.status(503).json({ message: 'Notification preferences service unavailable' });
            }
            const email = (req.user?.email || '').trim().toLowerCase();
            if (!email) return res.status(400).json({ message: 'User email not found' });
            const preferences = await studentNotificationService.saveStudentNotificationPreferences(email, req.body || {});
            res.status(200).json({ message: 'Notification preferences saved', preferences });
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
            await db.recordSyncDeletion('users', email.trim().toLowerCase());
            try {
                io.emit('users_updated');
                io.emit('admin_stats_update');
                db.triggerSync();
            } catch (_) { }
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
            } catch (_) { }
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
                const hashedUpdatePass = hashPassword(password.trim());
                await db.run(
                    'UPDATE users SET name = ?, email = ?, role = ?, status = ?, password = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
                    newName, newEmail, newRole, newStatus, hashedUpdatePass, existing.id, existing.email
                );
            } else {
                await db.run(
                    'UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
                    newName, newEmail, newRole, newStatus, existing.id, existing.email
                );
            }

            await syncUserEmailAcrossData(existing.id, existing.email, newEmail, newName, newRole);
            try {
                io.emit('users_updated');
                io.emit('admin_stats_update');
                db.triggerSync();
            } catch (_) { }

            const updatedUser = await db.get('SELECT id, name, email, role, status, lastLogin FROM users WHERE id = ?', existing.id);
            res.status(200).json({ message: 'User updated successfully', user: sanitizeUser(updatedUser) });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.post('/users/send-email-change-otp', authenticateToken, async (req, res) => {
        try {
            const { newEmail } = req.body || {};
            if (!newEmail || !newEmail.trim()) {
                return res.status(400).json({ message: 'New email address is required' });
            }
            const cleanEmail = newEmail.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                return res.status(400).json({ message: 'Please enter a valid email address' });
            }
            if (String(req.user?.role || '').toLowerCase() !== 'admin' && !cleanEmail.endsWith('@cvsu.edu.ph')) {
                return res.status(400).json({ message: 'Access restricted: Only official @cvsu.edu.ph email accounts are permitted.' });
            }

            const currentEmail = (req.user.email || '').trim().toLowerCase();
            if (cleanEmail === currentEmail) {
                return res.status(400).json({ message: 'New email must be different from your current email' });
            }

            const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
            const existingAdmin = await db.get('SELECT id FROM admin_users WHERE LOWER(email) = ? AND id != ?', cleanEmail, req.user.id);
            if (existingUser || existingAdmin) {
                return res.status(400).json({ message: 'This email is already in use by another account' });
            }

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
            if (!emailResult || !emailResult.success) {
                await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ?', cleanEmail).catch(() => { });
                return sendEmailDeliveryError(res, cleanEmail, emailResult);
            }

            res.status(200).json({ message: `Verification code sent to ${cleanEmail}`, email: cleanEmail, expiresInMinutes: 15 });
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
            if (!record) return res.status(400).json({ message: 'No verification code found. Please request a new code.' });

            const expiresAt = Number(record.expires_at || record.expiresat || 0);
            if (Date.now() > expiresAt) {
                await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
                return res.status(400).json({ message: 'This verification code has expired. Please request a new one.' });
            }

            const otpAttemptKey = `otp_email:${req.user.id}:${cleanEmail}`;
            const attempts = (otpAttemptCounts.get(otpAttemptKey) || 0) + 1;
            if (String(record.otp_code || record.otpcode).trim() !== cleanOtp) {
                otpAttemptCounts.set(otpAttemptKey, attempts);
                if (attempts >= 5) {
                    otpAttemptCounts.delete(otpAttemptKey);
                    await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
                    return res.status(429).json({ message: 'Too many invalid attempts. Please request a new code.' });
                }
                return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
            }
            otpAttemptCounts.delete(otpAttemptKey);

            let otpMeta = null;
            try { otpMeta = JSON.parse(record.user_data || record.userdata || '{}'); } catch (_) { }
            if (!otpMeta || String(otpMeta.userId) !== String(req.user.id) || otpMeta.action !== 'change_email') {
                return res.status(403).json({ message: 'Verification session does not belong to the authenticated user.' });
            }

            let hashedNewPassword = null;
            if (newPassword && newPassword.trim()) {
                const pwdErr = await validatePassword(newPassword.trim());
                if (pwdErr) return res.status(400).json({ message: pwdErr });
                hashedNewPassword = hashPassword(newPassword.trim());
            }

            const userId = req.user.id;
            const current = await db.get('SELECT * FROM users WHERE id = ?', userId);
            if (!current) {
                const adminCurrent = await db.get('SELECT * FROM admin_users WHERE id = ?', userId);
                if (!adminCurrent) return res.status(404).json({ message: 'User account not found' });

                const oldAdminEmail = (adminCurrent.email || '').trim().toLowerCase();
                await db.run('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldAdminEmail);
                await db.run('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?', oldAdminEmail, userId).catch(() => { });
                if (hashedNewPassword) {
                    await db.run('UPDATE admin_users SET password = ? WHERE id = ?', hashedNewPassword, userId);
                }
                const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
                if (localSqlite) {
                    try {
                        localSqlite.prepare('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanEmail, userId, oldAdminEmail);
                        localSqlite.prepare('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?').run(oldAdminEmail, userId);
                    } catch (_) { }
                }
                await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
                await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ? OR LOWER(email) = ?', cleanEmail, oldAdminEmail).catch(() => { });
                const updatedUser = sanitizeUser({ ...adminCurrent, email: cleanEmail });
                const token = jwt.sign(
                    { id: updatedUser.id, email: cleanEmail, role: 'Admin', name: updatedUser.name, isAdmin: true },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                return res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
            }

            const oldEmail = (current.email || '').trim().toLowerCase();
            await db.run('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldEmail);
            await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', oldEmail, userId).catch(() => { });
            if (hashedNewPassword) {
                await db.run('UPDATE users SET password = ? WHERE id = ?', hashedNewPassword, userId);
            }
            await syncUserEmailAcrossData(userId, oldEmail, cleanEmail, current.name, current.role);

            if (current.role === 'Admin') {
                await db.run('UPDATE admin_users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanEmail, userId, oldEmail).catch(() => { });
                await db.run('DELETE FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?', oldEmail, userId).catch(() => { });
            }

            const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
            if (localSqlite) {
                try {
                    localSqlite.prepare('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanEmail, userId, oldEmail);
                    localSqlite.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').run(oldEmail, userId);
                    if (hashedNewPassword) {
                        localSqlite.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedNewPassword, userId);
                    }
                } catch (_) { }
            }

            await db.run('DELETE FROM otp_verifications WHERE id = ?', record.id);
            await db.run('DELETE FROM otp_verifications WHERE LOWER(email) = ? OR LOWER(email) = ?', cleanEmail, oldEmail).catch(() => { });

            const updatedUser = {
                id: current.id, name: current.name, email: cleanEmail,
                role: current.role, avatar: current.avatar, status: current.status
            };
            const token = jwt.sign(
                { id: updatedUser.id, email: cleanEmail, role: updatedUser.role, name: updatedUser.name },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            io.emit('user_avatar_updated', {
                userId: updatedUser.id, name: updatedUser.name, email: cleanEmail,
                avatar: updatedUser.avatar, role: updatedUser.role
            });
            res.status(200).json({ message: 'Email address updated successfully', user: updatedUser, token });
        } catch (e) {
            console.error('Error verifying email change:', e);
            res.status(500).json({ message: e.message || 'Failed to update email' });
        }
    });

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
            if (!user) return res.status(404).json({ message: 'User account not found' });

            const isGoogleSso = user.password === 'google_sso_user';
            if (!isGoogleSso) {
                if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
                const curCheck = verifyPassword(currentPassword, user.password);
                if (!curCheck.valid) return res.status(400).json({ message: 'Current password is incorrect' });
                if (currentPassword.trim() === newPassword.trim()) {
                    return res.status(400).json({ message: 'New password must be different from your current password' });
                }
            }

            const passwordError = await validatePassword(newPassword.trim());
            if (passwordError) return res.status(400).json({ message: passwordError });

            const hashedPassword = hashPassword(newPassword.trim());
            if (isAdmin) {
                await db.run('UPDATE admin_users SET password = ? WHERE id = ?', hashedPassword, userId);
            } else {
                await db.run('UPDATE users SET password = ? WHERE id = ?', hashedPassword, userId);
            }
            res.status(200).json({ message: 'Password updated successfully' });
        } catch (e) {
            console.error('Error changing password:', e);
            res.status(500).json({ message: e.message || 'Failed to update password' });
        }
    });

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
                    const rawPass = u.password || crypto.randomBytes(12).toString('base64url');
                    const pass = hashPassword(String(rawPass));
                    const role = u.role || 'Student';
                    const status = u.status || 'Active';
                    await db.run('INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)', u.name, u.email, pass, role, status);
                    await db.clearSyncDeletion('users', String(u.email).trim().toLowerCase()).catch(() => { });
                    added++;
                }
            }
            if (added > 0) {
                try { db.triggerSync(); } catch (_) { }
            }
            res.status(200).json({ message: `Roster import complete: ${added} added, ${skipped} skipped (already exists).`, added, skipped });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });
}

module.exports = { registerUserRoutes };
