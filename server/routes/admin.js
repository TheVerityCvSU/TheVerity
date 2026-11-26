const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitizeUser } = require('../utils/passwordHash');
const { todayKey } = require('../utils/serverHelpers');

/**
 * Registers admin dashboard stats, notifications, audit logs, system settings,
 * database backups, access tokens, and question bank routes.
 */
function registerAdminRoutes(app, { db, io, DATA_DIR, authMiddleware, settingsService, activeStudentsService }) {
    const { authenticateToken, requireRole } = authMiddleware;
    const { getMaintenanceStatus, getKioskSettings, runDataRetentionMaintenance } = settingsService;
    const { activeStudents } = activeStudentsService;

    app.get('/stats', authenticateToken, requireRole('Admin'), async (req, res) => {
        try {
            const activeUsersRow = await db.get("SELECT COUNT(id) as c FROM users WHERE COALESCE(status, 'Active') NOT IN ('Pending', 'Disabled', 'Suspended')");
            const activeClassroomsRow = await db.get('SELECT COUNT(id) as c FROM classrooms');
            const tKey = todayKey();

            let securityFlagsToday = 0;
            let altTabCopyPasteFlags = 0;
            try {
                const flagRow = await db.get('SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?', tKey);
                if (flagRow) {
                    securityFlagsToday = Number(flagRow.count || 0);
                    altTabCopyPasteFlags = Number(flagRow.alt_tab_copy_paste_count || 0);
                }
            } catch (_) { }

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
                if (auditAltCount > altTabCopyPasteFlags) altTabCopyPasteFlags = auditAltCount;
                if (auditSecCount > securityFlagsToday) securityFlagsToday = auditSecCount;
            } catch (_) { }

            res.status(200).json({
                activeUsers: activeUsersRow ? Number(activeUsersRow.c) : 0,
                activeClassrooms: activeClassroomsRow ? Number(activeClassroomsRow.c) : 0,
                securityFlagsToday,
                altTabCopyPasteFlags
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/notifications', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
        try {
            const notifs = [];
            const pendingRow = await db.get("SELECT COUNT(id) as c FROM users WHERE role = 'Teacher' AND status = 'Pending'");
            const pendingCount = pendingRow ? Number(pendingRow.c) : 0;
            if (pendingCount > 0) {
                notifs.push({
                    id: 'pending-instructors',
                    title: 'Pending Instructor Approvals',
                    text: `${pendingCount} instructor(s) awaiting registration approval.`
                });
            }
            const flagRow = await db.get('SELECT count, alt_tab_copy_paste_count FROM security_flags WHERE date_string = ?', todayKey());
            const secFlags = flagRow ? Number(flagRow.count || 0) : 0;
            const altTabFlags = flagRow ? Number(flagRow.alt_tab_copy_paste_count || 0) : 0;
            if (secFlags > 0 || altTabFlags > 0) {
                notifs.push({
                    id: 'security-flags-today',
                    title: 'Kiosk Security Activity Today',
                    text: `${altTabFlags} Alt-Tab/Copy-Paste flag(s) & ${secFlags} security alert(s) recorded today.`
                });
            }

            const startOfDay = `${todayKey()}T00:00:00.000Z`;
            const maliciousRow = await db.get(`SELECT COUNT(id) as c FROM audit_logs WHERE type LIKE '%Malicious%' AND timestamp >= ?`, startOfDay).catch(() => null);
            const maliciousCount = maliciousRow ? Number(maliciousRow.c || 0) : 0;
            if (maliciousCount > 0) {
                notifs.push({
                    id: 'malicious-scripts-today',
                    title: '🚨 Malicious Script Warning',
                    text: `${maliciousCount} malicious code execution attempt(s) detected and blocked by sandbox today.`
                });
            }

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

    app.get('/audit-logs', authenticateToken, requireRole('Admin'), async (req, res) => {
        try {
            const logs = await db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300');
            res.status(200).json({ logs });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    const clientAuditRateMap = new Map();
    const ALLOWED_CLIENT_AUDIT_TYPES = new Set([
        'Exit Tab Violation',
        'System Exit Violation',
        'Copy/Paste Violation',
        'Copy-Paste Violation',
        'Alt-Tab Violation',
        'System Crash Violation',
        'Security Flag Alert',
        'System Event',
        'Kiosk Violation',
        'Event'
    ]);

    app.post('/audit-logs', authenticateToken, async (req, res) => {
        try {
            const { user: requestedUser = 'System', type = 'Event', severity = 'Normal', desc = '' } = req.body || {};
            const roleLower = String(req.user?.role || '').toLowerCase();
            const isPrivileged = roleLower === 'admin' || roleLower === 'teacher' || roleLower === 'instructor';
            const user = roleLower === 'admin'
                ? (requestedUser || req.user?.name || req.user?.email || 'Admin')
                : (req.user?.name || req.user?.email || 'Student');

            if (!isPrivileged) {
                const rateKey = String(req.user?.id || req.user?.email || user).toLowerCase();
                const now = Date.now();
                const rec = clientAuditRateMap.get(rateKey) || { count: 0, resetAt: now + 60000 };
                if (now > rec.resetAt) {
                    rec.count = 0;
                    rec.resetAt = now + 60000;
                }
                if (rec.count >= 30) {
                    return res.status(429).json({ message: 'Too many audit events submitted. Please wait.' });
                }
                rec.count += 1;
                clientAuditRateMap.set(rateKey, rec);
            }

            const safeType = isPrivileged
                ? String(type || 'Event').slice(0, 80)
                : (ALLOWED_CLIENT_AUDIT_TYPES.has(String(type || '')) ? String(type) : 'Security Flag Alert');
            const allowedSeverities = new Set(['Normal', 'Warning', 'High']);
            const safeSeverity = allowedSeverities.has(String(severity)) ? String(severity) : 'Normal';
            const safeDesc = String(desc || '').slice(0, 500);
            const timestamp = new Date().toISOString();
            await db.run(
                'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                timestamp, user, safeType, safeSeverity, safeDesc
            );

            if (safeSeverity === 'High' || safeSeverity === 'Warning') {
                const key = todayKey();
                const descLower = safeDesc.toLowerCase();
                const typeLower = safeType.toLowerCase();
                const isCrash = typeLower.includes('crash') || descLower.includes('crash');
                const isSystemExit = !isCrash && (typeLower.includes('system exit') || descLower.includes('system exit') || descLower.includes('exited system') || descLower.includes('exited the system'));
                const isAltTabCopyPaste = !isCrash && (isSystemExit || descLower.includes('tab') || descLower.includes('paste') || descLower.includes('clipboard') || descLower.includes('copy') || descLower.includes('exit tab') || typeLower.includes('alt-tab') || typeLower.includes('copy-paste'));

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

                const timeText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                const actionText = isCrash ? 'System Crash' : (isAltTabCopyPaste ? (descLower.includes('paste') ? 'Copy/Paste' : 'Alt Tab') : (safeType || 'Violation'));
                const colorVal = isCrash ? '#dc2626' : (isAltTabCopyPaste ? '#eab308' : '#ef4444');

                const foundActive = Object.values(activeStudents).find(s => s && (s.studentId === user || s.name === user));
                const cId = foundActive?.classroomId || 'none';
                const aId = foundActive?.assignmentId || 'none';

                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    cId, aId, String(user), String(user), actionText, actionText, timeText, colorVal
                ).catch(() => { });

                if (aId && aId !== 'none' && aId !== 'default') {
                    io.to(`classroom:${cId}:assignment:${aId}`).emit('teacher_receive_alert', {
                        id: Date.now(), studentId: user, studentName: user, name: user,
                        action: actionText, message: actionText, time: timeText, color: colorVal,
                        isCrash, classroomId: cId, assignmentId: aId
                    });
                }

                io.emit('admin_security_alert', {
                    user, name: user, studentId: user, type: safeType, desc: safeDesc, action: safeDesc,
                    isAltTabCopyPaste, isSystemExit, timestamp
                });
                io.emit('admin_stats_update');
            }

            res.status(201).json({ message: 'Log entry saved', timestamp });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/system-settings', authenticateToken, async (req, res) => {
        try {
            const rows = await db.all('SELECT key, value FROM system_settings');
            const settings = {};
            rows.forEach(r => {
                try { settings[r.key] = JSON.parse(r.value); }
                catch { settings[r.key] = r.value; }
            });
            res.status(200).json({ settings });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.post('/api/admin/backup', authenticateToken, requireRole('Admin'), async (req, res) => {
        try {
            const backupsDir = path.join(DATA_DIR, 'backups');
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

            const tables = ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements', 'system_settings', 'audit_logs'];
            const snapshot = {
                generatedAt: new Date().toISOString(),
                generatedBy: req.user?.email || req.user?.name || 'Admin',
                version: process.env.APP_VERSION || '1.0.0',
                tables: {}
            };

            for (const tbl of tables) {
                try {
                    const rows = await db.all(`SELECT * FROM ${tbl}`);
                    snapshot.tables[tbl] = (tbl === 'users' || tbl === 'admin_users')
                        ? (rows || []).map(sanitizeUser)
                        : (rows || []);
                } catch (_) {
                    snapshot.tables[tbl] = [];
                }
            }

            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `verity_backup_${stamp}.json`;
            const filePath = path.join(backupsDir, filename);
            const jsonContent = JSON.stringify(snapshot, null, 2);
            fs.writeFileSync(filePath, jsonContent, 'utf8');

            const userName = req.user?.email || req.user?.name || 'Admin';
            await db.run(
                'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
                userName, 'Database Backup', 'Normal',
                `Admin generated full system backup (${filename}, ${(Buffer.byteLength(jsonContent) / 1024).toFixed(1)} KB)`
            ).catch(() => { });

            res.status(200).json({
                success: true, filename,
                sizeBytes: Buffer.byteLength(jsonContent),
                generatedAt: snapshot.generatedAt,
                backup: snapshot
            });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    const handleSaveSettings = async (req, res) => {
        try {
            const { settings } = req.body || {};
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ message: 'Invalid settings object' });
            }
            const enrichedSettings = {};
            for (const [key, val] of Object.entries(settings)) {
                const payload = (val && typeof val === 'object' && !Array.isArray(val)) ? { ...val, _updatedAt: Date.now() } : val;
                enrichedSettings[key] = payload;
                const strVal = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
                await db.run('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, strVal);
            }
            io.emit('system_settings_updated', { settings: enrichedSettings });
            getKioskSettings().then(kioskConfig => io.emit('kiosk_settings', kioskConfig)).catch(() => { });
            db.triggerSync();
            runDataRetentionMaintenance().catch(() => { });
            const userName = req.user?.email || req.user?.name || 'unknown';
            await db.run('INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)', userName, 'System Settings Updated', 'Normal', 'Admin updated system settings via API');
            res.status(200).json({ message: 'Settings saved successfully' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    };

    app.put('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);
    app.post('/system-settings', authenticateToken, requireRole('Admin'), handleSaveSettings);

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
                const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
                const tokenStr = `VRTY-EXAM-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}`;
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

    app.get('/question-bank', authenticateToken, requireRole('Admin', 'Teacher'), async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM question_bank ORDER BY id DESC');
            const questions = rows.map(q => ({ ...q, test_cases: JSON.parse(q.test_cases || '[]') }));
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
}

module.exports = { registerAdminRoutes };
