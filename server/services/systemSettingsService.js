const { todayKey, extractClientIp } = require('../utils/serverHelpers');

const DEFAULT_PASSWORD_POLICIES = {
    specialChars: true,
    numbers: true,
    minLength8: true
};

/**
 * Manages system settings lookups, password validation, maintenance status,
 * concurrent multi-login tracking, malicious script logging, and retention pruning.
 */
function createSystemSettingsService({ db, io, activeStudents }) {
    const activeLoginSessions = new Map();
    const LOGIN_SESSION_WINDOW_MS = 30 * 60 * 1000;

    const getPasswordPolicies = async () => {
        try {
            const globalRow = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (globalRow && globalRow.value) {
                const parsed = typeof globalRow.value === 'string' ? JSON.parse(globalRow.value) : globalRow.value;
                if (parsed?.security?.passwordPolicies && typeof parsed.security.passwordPolicies === 'object') {
                    return { ...DEFAULT_PASSWORD_POLICIES, ...parsed.security.passwordPolicies };
                }
            }
            const secRow = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
            if (secRow && secRow.value) {
                const parsed = typeof secRow.value === 'string' ? JSON.parse(secRow.value) : secRow.value;
                if (parsed?.passwordPolicies && typeof parsed.passwordPolicies === 'object') {
                    return { ...DEFAULT_PASSWORD_POLICIES, ...parsed.passwordPolicies };
                }
            }
        } catch (_) { }
        return { ...DEFAULT_PASSWORD_POLICIES };
    };

    const validatePassword = async (password) => {
        try {
            const str = String(password || '');
            const policies = await getPasswordPolicies();
            if (policies.minLength8 && str.length < 8) return 'Password must be at least 8 characters long.';
            if (policies.numbers && !/\d/.test(str)) return 'Password must contain at least one number.';
            if (policies.specialChars && !/[!@#$%^&*(),.?":{}|<>_\-\\[\];'`~+/=]/.test(str)) {
                return 'Password must contain at least one special character.';
            }
        } catch (_) { }
        return null;
    };

    const getMaintenanceStatus = async () => {
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row && row.value) {
                const config = JSON.parse(row.value);
                if (config.general && config.general.maintenanceMode) {
                    return {
                        enabled: true,
                        message: config.general.offlineMessage || 'The system is currently undergoing maintenance. Please try again later.'
                    };
                }
            }
        } catch (_) { }
        return { enabled: false, message: '' };
    };

    const getTreatWarningsAsErrors = async () => {
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
        } catch (_) { }
        return false;
    };

    const getKioskSettings = async () => {
        const defaults = {
            flagTabExits: true,
            blockCopyPaste: true,
            flagMultipleLogins: true,
            violationThreshold: 3,
            sessionTimeout: '30m',
            cognitivePauseThreshold: 45,
            strictClipboardBlocking: true,
            enforceSingleMonitor: true,
            disableWindowsKeyAltTab: true,
            blockVirtualMachine: true,
            passwordPolicies: { ...DEFAULT_PASSWORD_POLICIES }
        };
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (row && row.value) {
                const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                if (parsed && parsed.security) {
                    return {
                        ...defaults,
                        ...parsed.security,
                        passwordPolicies: {
                            ...DEFAULT_PASSWORD_POLICIES,
                            ...(parsed.security.passwordPolicies || {})
                        }
                    };
                }
            }
            const secRow = await db.get("SELECT value FROM system_settings WHERE key = 'security'");
            if (secRow && secRow.value) {
                const parsed = typeof secRow.value === 'string' ? JSON.parse(secRow.value) : secRow.value;
                return {
                    ...defaults,
                    ...parsed,
                    passwordPolicies: {
                        ...DEFAULT_PASSWORD_POLICIES,
                        ...(parsed.passwordPolicies || {})
                    }
                };
            }
        } catch (_) { }
        return defaults;
    };

    const checkAndFlagMultipleLogins = async (user, reqOrSocket, socketId = null) => {
        try {
            if (!user || !user.email || user.role === 'Admin' || user.role === 'admin') return;
            const emailKey = String(user.email).trim().toLowerCase();
            const ip = extractClientIp(reqOrSocket);
            const now = Date.now();

            let ipMap = activeLoginSessions.get(emailKey);
            if (!ipMap) {
                ipMap = new Map();
                activeLoginSessions.set(emailKey, ipMap);
            }

            for (const [existingIp, meta] of ipMap.entries()) {
                if (meta.socketIds.size === 0 && now - meta.lastSeen > LOGIN_SESSION_WINDOW_MS) {
                    ipMap.delete(existingIp);
                }
            }

            const otherActiveIps = [...ipMap.keys()].filter((k) => k !== ip);
            const currentEntry = ipMap.get(ip) || { lastSeen: now, socketIds: new Set() };
            currentEntry.lastSeen = now;
            if (socketId) currentEntry.socketIds.add(socketId);
            ipMap.set(ip, currentEntry);

            if (otherActiveIps.length === 0) return;

            const kioskCfg = await getKioskSettings();
            if (kioskCfg?.flagMultipleLogins === false) return;

            const desc = `Concurrent login detected for ${user.name || emailKey} (${emailKey}) from ${ip} while active at ${otherActiveIps.join(', ')}`;
            await db.run(
                'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
                user.name || emailKey,
                'Multiple Login Detected',
                'High',
                desc
            ).catch(() => { });

            const tKey = todayKey();
            await db.run(`
                INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count)
                VALUES (?, 1, 0)
                ON CONFLICT(date_string) DO UPDATE SET count = security_flags.count + 1
            `, tKey).catch(() => { });

            io.to('role:admin').emit('receive_alert', {
                studentId: user.id || emailKey,
                studentName: user.name || emailKey,
                action: 'Multiple Login',
                message: desc,
                severity: 'High',
                color: '#ef4444',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            io.to('role:admin').emit('admin_stats_update');
        } catch (_) { }
    };

    const recordMaliciousScriptAttempt = async ({ socket, data, securityCheck }) => {
        try {
            const userName = socket?.user?.name || socket?.user?.email || data?.username || data?.user?.name || 'Unknown User';
            const studentId = socket?.user?.id || data?.user?.id || userName;
            const nowIso = new Date().toISOString();
            const tKey = todayKey();

            const foundActive = Object.values(activeStudents).find(s => s && (s.studentId === userName || s.name === userName || s.studentId === studentId));
            const classroomId = data?.classroomId || foundActive?.classroomId || null;
            const assignmentId = data?.assignmentId || foundActive?.assignmentId || null;

            const logType = 'Malicious Script Attempt';
            const logSeverity = 'High';
            const desc = `Blocked malicious script execution attempt: [Rule: ${securityCheck.rule}] ${securityCheck.message} in ${securityCheck.fileName || 'Program.cs'} (Line ${securityCheck.line || 1}:${securityCheck.column || 1})`;

            console.warn(`[Security Alert] Malicious script attempt by "${userName}": ${desc}`);

            await db.run(
                'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                nowIso, userName, logType, logSeverity, desc
            );

            await db.run(
                `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
                tKey
            );

            if (classroomId && assignmentId && assignmentId !== 'none' && assignmentId !== 'default') {
                const timeText = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    classroomId, assignmentId, String(userName), String(userName),
                    'Malicious Script', `Blocked malicious script: ${securityCheck.rule}`, timeText, '#dc2626'
                ).catch(() => { });

                const targetRoom = `classroom:${classroomId}:assignment:${assignmentId}`;
                io.to(targetRoom).emit('teacher_receive_alert', {
                    id: Date.now(),
                    studentId: userName,
                    studentName: userName,
                    name: userName,
                    action: 'Malicious Script',
                    message: `Security violation: ${securityCheck.rule} - ${securityCheck.message}`,
                    time: timeText,
                    color: '#dc2626',
                    isCrash: false,
                    classroomId,
                    assignmentId
                });
            }

            io.to('role:admin').emit('admin_security_alert', {
                user: userName,
                name: userName,
                studentId,
                type: logType,
                severity: logSeverity,
                desc,
                action: desc,
                rule: securityCheck.rule,
                fileName: securityCheck.fileName || 'Program.cs',
                line: securityCheck.line || 1,
                column: securityCheck.column || 1,
                classroomId,
                assignmentId,
                isAltTabCopyPaste: false,
                isSystemExit: false,
                isMaliciousScript: true,
                timestamp: nowIso
            });

            io.emit('admin_stats_update');
            io.emit('users_updated');
        } catch (err) {
            console.error('Error recording malicious script attempt:', err);
        }
    };

    const runDataRetentionMaintenance = async () => {
        try {
            const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
            if (!row || !row.value) return;
            const config = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            const dataCfg = config?.data || {};
            const now = Date.now();

            const retention = String(dataCfg.retentionPeriod || '3 Years');
            let retentionMs = null;
            if (retention === '1 Year') retentionMs = 365 * 24 * 60 * 60 * 1000;
            else if (retention === '3 Years') retentionMs = 3 * 365 * 24 * 60 * 60 * 1000;

            if (retentionMs) {
                const cutoffMs = now - retentionMs;
                const archivedClasses = await db.all('SELECT id FROM classrooms WHERE archived = 1').catch(() => []);
                for (const cls of archivedClasses) {
                    const clsIdNum = Number(cls.id);
                    if (!isNaN(clsIdNum) && clsIdNum > 1e12 && clsIdNum < cutoffMs) {
                        const cwRows = await db.all('SELECT id FROM classwork WHERE classroom_id = ?', cls.id).catch(() => []);
                        const annRows = await db.all('SELECT id FROM announcements WHERE classroom_id = ?', cls.id).catch(() => []);
                        const enrRows = await db.all('SELECT student_email FROM enrollments WHERE classroom_id = ?', cls.id).catch(() => []);
                        await db.run('DELETE FROM enrollments WHERE classroom_id = ?', cls.id).catch(() => { });
                        await db.run('DELETE FROM classwork WHERE classroom_id = ?', cls.id).catch(() => { });
                        await db.run('DELETE FROM announcements WHERE classroom_id = ?', cls.id).catch(() => { });
                        await db.run('DELETE FROM classrooms WHERE id = ?', cls.id).catch(() => { });
                        for (const cw of (cwRows || [])) await db.recordSyncDeletion('classwork', String(cw.id)).catch(() => { });
                        for (const ann of (annRows || [])) await db.recordSyncDeletion('announcements', String(ann.id)).catch(() => { });
                        for (const en of (enrRows || [])) {
                            if (en?.student_email) await db.recordSyncDeletion('enrollments', `${cls.id}_${String(en.student_email).trim().toLowerCase()}`).catch(() => { });
                        }
                        await db.recordSyncDeletion('classrooms', String(cls.id)).catch(() => { });
                        try { db.triggerSync(); } catch (_) { }
                    }
                }
            }

            const auditPolicy = String(dataCfg.autoArchiveAuditLogs || '30 Days');
            let auditDays = null;
            if (auditPolicy === '7 Days') auditDays = 7;
            else if (auditPolicy === '30 Days') auditDays = 30;

            if (auditDays) {
                const cutoffIso = new Date(now - auditDays * 24 * 60 * 60 * 1000).toISOString();
                const logs = await db.all('SELECT id, timestamp FROM audit_logs').catch(() => []);
                for (const log of logs) {
                    if (log.timestamp) {
                        const ts = new Date(log.timestamp).getTime();
                        if (!isNaN(ts) && ts < new Date(cutoffIso).getTime()) {
                            await db.run('DELETE FROM audit_logs WHERE id = ?', log.id).catch(() => { });
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Data Retention] Maintenance notice:', e.message);
        }
    };

    return {
        DEFAULT_PASSWORD_POLICIES,
        getPasswordPolicies,
        validatePassword,
        getMaintenanceStatus,
        getTreatWarningsAsErrors,
        getKioskSettings,
        checkAndFlagMultipleLogins,
        recordMaliciousScriptAttempt,
        runDataRetentionMaintenance
    };
}

module.exports = { createSystemSettingsService, DEFAULT_PASSWORD_POLICIES };
