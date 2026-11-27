const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execSync } = require('child_process');
const { scanCSharpCode } = require('../csharpSecurityScanner');
const { todayKey } = require('../utils/serverHelpers');

function isValidCloudRelaySecret(providedSecret) {
    const expected = (process.env.CLOUD_RELAY_SECRET || '').trim();
    const provided = typeof providedSecret === 'string' ? providedSecret.trim() : '';
    if (!expected || !provided) return false;
    const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
    const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
    return crypto.timingSafeEqual(expectedDigest, providedDigest);
}

/**
 * Registers Socket.IO authentication middleware and real-time compiler, proctoring,
 * live classroom activity, submission, and disconnect handlers.
 */
function registerSocketHandlers(io, {
    db,
    IS_RENDER_CLOUD,
    dotnetManager,
    authMiddleware,
    settingsService,
    compilerService,
    classroomHelpers,
    activeStudentsService
}) {
    const { verifySessionToken, isLoopbackAddress } = authMiddleware;
    const { getKioskSettings, getTreatWarningsAsErrors, checkAndFlagMultipleLogins, recordMaliciousScriptAttempt } = settingsService;
    const {
        COMPILER_BASE_DIR, OFFLINE_DOTNET_ENV, OFFLINE_NUGET_CONFIG, sessionWorkspaces,
        resetDotnetCache, getDotnetTargetFramework, ensureBaseTemplate, getCompilerSpawnConfig,
        killProcessTree, parseCompilerDiagnostics, createSandboxedRunEnv, createEphemeralSandboxDir, cleanupEphemeralSandboxDir
    } = compilerService;
    const { getClassworkFromDb, saveClassworkToDb, checkClassroomAccess, resolveCanonicalStudent } = classroomHelpers;
    const {
        activeStudents, getActiveActivitiesMap, getActiveClassroomsMap,
        broadcastActiveActivities, removeStudentFromPreviousActivities,
        relayStudentActivity, relayProctorAlert, relayTerminalUpdate,
        relayStudentLeft, relaySubmitExam, relayUnsubmitExam
    } = activeStudentsService;

    let currentInstruction = '';
    const activeCompilesByUser = new Map();
    const MAX_CONCURRENT_COMPILES_PER_USER = 2;

    const acquireUserCompileSlot = (userKey) => {
        const cur = activeCompilesByUser.get(userKey) || 0;
        if (cur >= MAX_CONCURRENT_COMPILES_PER_USER) return false;
        activeCompilesByUser.set(userKey, cur + 1);
        return true;
    };

    const releaseUserCompileSlot = (userKey) => {
        const cur = activeCompilesByUser.get(userKey) || 0;
        if (cur <= 1) activeCompilesByUser.delete(userKey);
        else activeCompilesByUser.set(userKey, cur - 1);
    };

    const isSocketUserActiveInDb = async (verifiedUser) => {
        if (!verifiedUser) return false;
        const roleLower = String(verifiedUser.role || '').toLowerCase();
        const tbl = roleLower === 'admin' ? 'admin_users' : 'users';
        const lookupEmail = String(verifiedUser.email || '').trim().toLowerCase();
        try {
            const row = lookupEmail
                ? await db.get(`SELECT id, status FROM ${tbl} WHERE id = ? OR LOWER(email) = ?`, verifiedUser.id ?? -1, lookupEmail)
                : await db.get(`SELECT id, status FROM ${tbl} WHERE id = ?`, verifiedUser.id ?? -1);
            if (!row) return false;
            const statusLower = String(row.status || 'Active').toLowerCase();
            return statusLower !== 'disabled' && statusLower !== 'suspended' && statusLower !== 'pending';
        } catch (_) {
            return true;
        }
    };

    const joinSocketRoleRooms = (targetSocket, user) => {
        if (!targetSocket || !user) return;
        targetSocket.join('role:authenticated');
        const r = String(user.role || '').toLowerCase();
        if (r === 'admin') targetSocket.join('role:admin');
        if (r === 'teacher' || r === 'instructor') targetSocket.join('role:teacher');
    };

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (token) {
            const user = verifySessionToken(token);
            if (user && await isSocketUserActiveInDb(user)) {
                socket.user = user;
                joinSocketRoleRooms(socket, user);
            }
        }
        if (isValidCloudRelaySecret(socket.handshake.auth?.relaySecret)) {
            socket.isCloudRelay = true;
        }
        next();
    });

    io.on('connection', (socket) => {
        console.log('[Workspace] Student Connected: ' + socket.id);

        socket.on('join_google_auth_session', (sessionId) => {
            if (typeof sessionId === 'string' && /^[a-zA-Z0-9_-]{12,64}$/.test(sessionId)) {
                socket.join(`google-auth:${sessionId}`);
            }
        });

        socket.on('get_active_activities', (data) => {
            socket.emit('active_activities_update', {
                counts: getActiveActivitiesMap(data?.classroomId),
                classroomCounts: getActiveClassroomsMap()
            });
        });

        socket.on('teacher_leave', () => {
            if (socket.data.teacherRoom) {
                socket.leave(socket.data.teacherRoom);
                socket.data.teacherRoom = null;
            }
            if (socket.data.assignmentRoom) {
                socket.leave(socket.data.assignmentRoom);
                socket.data.assignmentRoom = null;
            }
        });

        socket.on('check_dotnet_status', (cb) => {
            const s = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
            if (typeof cb === 'function') cb(s);
            else socket.emit('dotnet_setup_progress', s);
        });

        socket.on('install_dotnet', async () => {
            const remoteIp = socket.handshake?.address || socket.conn?.remoteAddress || '';
            if (!socket.user && (IS_RENDER_CLOUD || !isLoopbackAddress(remoteIp))) {
                return socket.emit('error', { message: 'Access denied: authentication required.' });
            }
            await dotnetManager.startInstallDotnet(io, () => {
                resetDotnetCache();
                ensureBaseTemplate();
            });
        });

        socket.on('cancel_dotnet_install', () => {
            const remoteIp = socket.handshake?.address || socket.conn?.remoteAddress || '';
            if (!socket.user && (IS_RENDER_CLOUD || !isLoopbackAddress(remoteIp))) return;
            dotnetManager.cancelInstallDotnet(io);
        });

        let activeProcess = null;

        const authenticateSocket = async (targetSocket, token) => {
            if (targetSocket.user) {
                joinSocketRoleRooms(targetSocket, targetSocket.user);
                return targetSocket.user;
            }
            if (token && typeof token === 'string') {
                const verified = verifySessionToken(token);
                if (verified && await isSocketUserActiveInDb(verified)) {
                    targetSocket.user = verified;
                    joinSocketRoleRooms(targetSocket, verified);
                    targetSocket.emit('authenticated', { user: { id: verified.id, email: verified.email, role: verified.role } });
                    return targetSocket.user;
                }
            }
            return null;
        };

        const isSocketInstructorOrAdmin = (user) => {
            const r = String(user?.role || '').toLowerCase();
            return r === 'teacher' || r === 'instructor' || r === 'admin';
        };

        const ensureSocketAuthOrRelay = async (targetSocket, payload) => {
            if (targetSocket.isCloudRelay || targetSocket.user) return true;
            if (payload?.token && await authenticateSocket(targetSocket, payload.token)) return true;
            return false;
        };

        const resolveSocketStudentIdentity = (targetSocket, payload) => {
            if (!targetSocket.isCloudRelay && targetSocket.user && String(targetSocket.user.role || '').toLowerCase() === 'student') {
                const studentId = String(targetSocket.user.id || targetSocket.user.email || payload?.studentId || payload?.id || 'student');
                const studentName = String(targetSocket.user.name || targetSocket.user.email || studentId).trim();
                return { studentId, studentName };
            }
            const studentId = String(payload?.studentId || payload?.id || payload?.name || targetSocket.data?.studentId || 'student');
            const studentName = String(payload?.name || payload?.studentName || studentId || 'Student').trim();
            return { studentId, studentName };
        };

        const handshakeToken = socket.handshake.auth?.token;
        if (handshakeToken) {
            authenticateSocket(socket, handshakeToken).then((u) => {
                if (u) {
                    getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => { });
                }
            }).catch(() => { });
        }

        socket.on('authenticate', async (data) => {
            if (!data) return;
            let u = null;
            if (typeof data === 'string') u = await authenticateSocket(socket, data);
            else if (typeof data === 'object') u = await authenticateSocket(socket, data.token);
            if (u) {
                checkAndFlagMultipleLogins(u, socket, socket.id).catch(() => { });
                getKioskSettings().then(cfg => socket.emit('kiosk_settings', cfg)).catch(() => { });
            }
        });

        if (currentInstruction) socket.emit('instruction_update', currentInstruction);

        async function emitFilteredActiveStudents(classroomId, assignmentId) {
            const cIdStr = String(classroomId || 'none');
            const aIdStr = String(assignmentId || 'none');
            const filterKey = `${cIdStr}:${aIdStr}`;

            let submittedRows = [];
            try {
                submittedRows = await db.all(
                    `SELECT LOWER(student_name) as sname FROM submissions WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?`,
                    aIdStr, aIdStr
                ).catch(() => []);
            } catch (_) { }
            const submittedSet = new Set((submittedRows || []).map(r => r.sname));

            for (const [key, student] of Object.entries(activeStudents)) {
                if (!student || student.isLive === false || student.status === 'Offline' || student.status === 'Submitted' || student.submitted) continue;
                const curName = String(student.name || student.studentName || '').trim().toLowerCase();
                const curId = String(student.id || student.studentId || '').trim().toLowerCase();
                if (submittedSet.has(curName) || submittedSet.has(curId)) {
                    delete activeStudents[key];
                    continue;
                }
                const isMatch = (
                    key.startsWith(filterKey + ':') ||
                    (aIdStr !== 'none' && (
                        key.startsWith(`none:${aIdStr}:`) ||
                        key.includes(`:${aIdStr}:`) ||
                        String(student.assignmentId) === aIdStr
                    ))
                );
                if (isMatch) {
                    socket.emit('teacher_update_code', { ...student, logs: student.logs || [] });
                }
            }
        }

        socket.on('teacher_join', async (data) => {
            const { classroomId, assignmentId } = data || {};
            if (!socket.user) await authenticateSocket(socket, data?.token || socket.handshake.auth?.token);
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
            if (classroomId && classroomId !== 'none' && classroomId !== 'default') {
                const allowed = await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false);
                if (!allowed) return socket.emit('error', { message: 'Access denied: Classroom access forbidden.' });
            }

            const roomName = `classroom:${classroomId || 'none'}:assignment:${assignmentId || 'none'}`;
            if (socket.data.teacherRoom && socket.data.teacherRoom !== roomName) socket.leave(socket.data.teacherRoom);
            const assignmentRoom = (assignmentId && assignmentId !== 'none') ? `assignment:${assignmentId}` : null;
            if (socket.data.assignmentRoom && socket.data.assignmentRoom !== assignmentRoom) socket.leave(socket.data.assignmentRoom);

            socket.join(roomName);
            if (assignmentRoom) socket.join(assignmentRoom);
            socket.data.teacherRoom = roomName;
            socket.data.assignmentRoom = assignmentRoom;

            const cIdStr = String(classroomId || 'none');
            const aIdStr = String(assignmentId || 'none');
            let dbLogs = [];
            try {
                if (cIdStr && cIdStr !== 'none' && cIdStr !== 'undefined' && cIdStr !== 'default') {
                    dbLogs = await db.all(
                        `SELECT * FROM proctor_session_logs WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (classroom_id = ? OR CAST(classroom_id AS TEXT) = ? OR classroom_id IS NULL) ORDER BY id ASC`,
                        aIdStr, aIdStr, cIdStr, cIdStr
                    ).catch(() => []);
                } else {
                    dbLogs = await db.all(
                        `SELECT * FROM proctor_session_logs WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ? ORDER BY id ASC`,
                        aIdStr, aIdStr
                    ).catch(() => []);
                }
            } catch (_) { }

            if (Array.isArray(dbLogs) && dbLogs.length > 0) socket.emit('teacher_past_warnings', dbLogs);
            await emitFilteredActiveStudents(classroomId, assignmentId);
        });

        socket.on('teacher_request_sync', async ({ classroomId, assignmentId } = {}) => {
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) return;
            if (classroomId && classroomId !== 'none' && classroomId !== 'default') {
                const allowed = await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false);
                if (!allowed) return;
            }
            io.emit('cloud_request_lan_sync', { classroomId, assignmentId });
            await emitFilteredActiveStudents(classroomId, assignmentId);
        });

        socket.on('set_instruction', (text) => {
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) return;
            currentInstruction = text;
            io.emit('instruction_update', text);
        });

        socket.on('classwork_updated', async ({ classroomId, classwork } = {}) => {
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
            if (classroomId == null || !Array.isArray(classwork)) return;
            if (!(await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false))) {
                return socket.emit('error', { message: 'Access denied: Classroom access forbidden.' });
            }
            try {
                await saveClassworkToDb(classroomId, classwork, { allowEmpty: true });
                const updatedClasswork = await getClassworkFromDb(classroomId);
                socket.broadcast.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
            } catch (e) {
                console.error('Error in socket classwork_updated:', e);
                socket.broadcast.emit('classwork_changed', { classroomId, classwork });
            }
        });

        socket.on('classroom_theme_updated', async (data) => {
            if (!data) return;
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
            const { classroomId, theme } = data;
            if (classroomId) {
                if (!(await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false))) {
                    return socket.emit('error', { message: 'Access denied.' });
                }
                if (theme) {
                    try {
                        const themeStr = typeof theme === 'object' ? JSON.stringify(theme) : theme;
                        await db.run('UPDATE classrooms SET theme = ? WHERE id = ?', themeStr, classroomId);
                    } catch (e) {
                        console.error('Error persisting classroom theme via socket:', e);
                    }
                }
            }
            socket.broadcast.emit('classroom_theme_changed', data);
        });

        socket.on('teacher_announcement_posted', async (data) => {
            if (!data || !data.classroomId || !data.announcement) return;
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
            const { classroomId, announcement } = data;
            if (!(await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false))) {
                return socket.emit('error', { message: 'Access denied.' });
            }
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
                        title = excluded.title, details = excluded.details,
                        author = excluded.author, posted = excluded.posted
                `, announcementId, Number(classroomId), announcementTitle, announcementDetails, announcementAuthor, postedTime);
                await db.clearSyncDeletion('announcements', String(announcementId)).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
            } catch (e) {
                console.error('Error persisting announcement via socket:', e);
            }

            io.emit('announcement_posted', {
                classroomId: Number(classroomId),
                announcement: {
                    id: announcementId,
                    classroomId: Number(classroomId),
                    title: announcementTitle,
                    details: announcementDetails,
                    author: announcementAuthor,
                    posted: postedTime
                }
            });
        });

        socket.on('teacher_announcement_deleted', async (data) => {
            if (!data || !data.classroomId || !data.announcementId) return;
            if (!socket.user || !isSocketInstructorOrAdmin(socket.user)) {
                return socket.emit('error', { message: 'Access denied: Teacher role required.' });
            }
            const { classroomId, announcementId } = data;
            if (!(await checkClassroomAccess({ user: socket.user }, classroomId).catch(() => false))) {
                return socket.emit('error', { message: 'Access denied.' });
            }
            try {
                await db.run('DELETE FROM announcements WHERE id = ? AND classroom_id = ?', Number(announcementId), Number(classroomId));
                await db.recordSyncDeletion('announcements', String(announcementId)).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
            } catch (e) {
                console.error('Error deleting announcement via socket:', e);
            }
            io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(announcementId) });
        });

        async function compileStudentCode(projectDir, code, extraFiles = [], onFinished = null) {
            let slotReleased = false;
            const finishSlot = () => {
                if (slotReleased) return;
                slotReleased = true;
                if (typeof onFinished === 'function') onFinished();
            };
            fs.writeFileSync(path.join(projectDir, 'Program.cs'), code || '', 'utf8');
            const extraNames = new Set();
            for (const ef of extraFiles) {
                if (!ef || !ef.name || !ef.code) continue;
                const safeName = ef.name.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                if (safeName.toLowerCase() === 'program.cs') continue;
                fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
                extraNames.add(safeName);
            }
            try {
                for (const f of fs.readdirSync(projectDir)) {
                    if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                        try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) { }
                    }
                }
            } catch (_) { }

            socket.emit('terminal_output', 'Compiling...\n');
            socket.emit('compiler_diagnostics', []);

            const projectFile = path.join(projectDir, 'verity_base.csproj');
            const nugetFile = path.join(projectDir, 'nuget.config');
            const treatWarningsAsErrors = await getTreatWarningsAsErrors();
            const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);
            const dllPath = compilerConfig.dllPath;

            try {
                if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                    fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                }
            } catch (_) { }

            if (compilerConfig.mode === 'dotnet-build' && !fs.existsSync(path.join(projectDir, 'obj', 'project.assets.json'))) {
                try {
                    execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                } catch (_) { }
            }

            const buildProcess = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
            activeProcess = buildProcess;

            let rawCompilerOutput = '';
            buildProcess.stdout.on('data', (d) => { rawCompilerOutput += d.toString(); });
            buildProcess.stderr.on('data', (d) => { rawCompilerOutput += d.toString(); });

            const buildTimeout = setTimeout(() => {
                if (activeProcess === buildProcess) {
                    try { buildProcess.kill(); } catch (_) { }
                    socket.emit('terminal_output', '\n[Compilation timed out]\n');
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                    finishSlot();
                }
            }, 15000);

            buildProcess.on('error', (err) => {
                clearTimeout(buildTimeout);
                socket.emit('terminal_output', `\n[Compiler launch error: ${err.message}]\n`);
                socket.emit('process_exit', { code: 1 });
                activeProcess = null;
                finishSlot();
            });

            buildProcess.on('close', (buildCode) => {
                clearTimeout(buildTimeout);
                if (activeProcess !== buildProcess) {
                    finishSlot();
                    return;
                }

                socket.emit('compiler_diagnostics', parseCompilerDiagnostics(rawCompilerOutput));
                if (buildCode !== 0 || !fs.existsSync(dllPath)) {
                    socket.emit('terminal_output', rawCompilerOutput + '\n[Build failed. Fix the build errors and run again.]\n');
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                    finishSlot();
                    return;
                }

                socket.emit('terminal_output', 'Running...\n\n');
                socket.emit('program_started');

                const sandboxRunDir = createEphemeralSandboxDir('verity_sandbox_run_');
                const sandboxEnv = createSandboxedRunEnv(sandboxRunDir);
                const runProcess = spawn('dotnet', [dllPath], { cwd: sandboxRunDir, env: sandboxEnv });
                runProcess._sandboxRunDir = sandboxRunDir;
                runProcess._finishSlot = finishSlot;
                activeProcess = runProcess;

                let totalOutputBytes = 0;
                const MAX_OUTPUT_BYTES = 128 * 1024;
                let isOutputCapped = false;

                const executionTimeout = setTimeout(() => {
                    if (activeProcess === runProcess) {
                        try { killProcessTree(runProcess); } catch (_) { }
                        cleanupEphemeralSandboxDir(sandboxRunDir);
                        socket.emit('terminal_output', '\n[Process terminated: Execution limit of 20s exceeded]\n');
                        socket.emit('process_exit', { code: 1 });
                        activeProcess = null;
                        finishSlot();
                    }
                }, 20000);

                runProcess.on('error', (err) => {
                    clearTimeout(executionTimeout);
                    cleanupEphemeralSandboxDir(sandboxRunDir);
                    socket.emit('terminal_output', `\n[Execution error: ${err.message}]\n`);
                    socket.emit('process_exit', { code: 1 });
                    activeProcess = null;
                    finishSlot();
                });

                const handleRunOutput = (data) => {
                    if (isOutputCapped) return;
                    totalOutputBytes += data.length;
                    if (totalOutputBytes > MAX_OUTPUT_BYTES) {
                        isOutputCapped = true;
                        try { killProcessTree(runProcess); } catch (_) { }
                        cleanupEphemeralSandboxDir(sandboxRunDir);
                        socket.emit('terminal_output', '\n\n[Process terminated: Execution output exceeded 128 KB limit (Infinite output loop detected)]\n');
                        socket.emit('process_exit', { code: 1 });
                        activeProcess = null;
                        finishSlot();
                        return;
                    }
                    socket.emit('terminal_output', data.toString());
                };

                runProcess.stdout.on('data', handleRunOutput);
                runProcess.stderr.on('data', handleRunOutput);
                runProcess.on('close', (runCode) => {
                    clearTimeout(executionTimeout);
                    cleanupEphemeralSandboxDir(sandboxRunDir);
                    socket.emit('terminal_output', `\n[Process exited with code ${runCode ?? 0}]\n`);
                    socket.emit('process_exit', { code: runCode ?? 0 });
                    activeProcess = null;
                    finishSlot();
                });
            });
        }

        socket.on('compile_code', async (data) => {
            try {
                if (!socket.user) await authenticateSocket(socket, data?.token || socket.handshake.auth?.token);
                if (!socket.user) {
                    socket.emit('terminal_output', 'Error: Authentication required to execute code. Please log in.\n');
                    return socket.emit('process_exit', { code: 1 });
                }

                const { code, extraFiles = [], language } = data || {};
                if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
                    socket.emit('terminal_output', `\n[Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.]\n`);
                    return socket.emit('process_exit', { code: 1 });
                }

                const dotnetStatus = dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV);
                if (!dotnetStatus.installed) {
                    socket.emit('terminal_output', '\n[Error: Microsoft .NET SDK is not installed on this machine.]\n[Verity C# Compiler requires Microsoft .NET SDK. Please reinstall The Verity and select the Microsoft .NET SDK option in the installer, or download it from https://dotnet.microsoft.com/download/dotnet/8.0]\n');
                    socket.emit('dotnet_missing', { error: 'DOTNET_NOT_INSTALLED' });
                    return socket.emit('process_exit', { code: 1 });
                }

                const securityCheck = scanCSharpCode(code, extraFiles);
                if (!securityCheck.isSafe) {
                    await recordMaliciousScriptAttempt({ socket, data, securityCheck });
                    socket.emit('compiler_diagnostics', [{
                        severity: 'error',
                        message: `[Security Violation] ${securityCheck.message}`,
                        startLineNumber: securityCheck.line || 1,
                        startColumn: securityCheck.column || 1,
                        endLineNumber: securityCheck.line || 1,
                        endColumn: (securityCheck.column || 1) + 12
                    }]);
                    socket.emit('terminal_output', `\n[Security Alert: Code execution blocked by Verity Sandbox]\n[File: ${securityCheck.fileName}, Line ${securityCheck.line}:${securityCheck.column}]\n[Rule: ${securityCheck.rule}]\n[Detail: ${securityCheck.message}]\n\n`);
                    return socket.emit('process_exit', { code: 1 });
                }

                const studentKey = socket.user?.id
                    ? `u_${socket.user.id}`
                    : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

                if (activeProcess) {
                    const prevFinish = activeProcess._finishSlot;
                    try { killProcessTree(activeProcess); } catch (_) { }
                    activeProcess = null;
                    if (typeof prevFinish === 'function') prevFinish();
                }

                if (!acquireUserCompileSlot(studentKey)) {
                    socket.emit('terminal_output', '\n[Compiler busy: Too many concurrent executions for this account. Please wait.]\n');
                    return socket.emit('process_exit', { code: 1 });
                }
                const releaseThisSlot = () => releaseUserCompileSlot(studentKey);

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
                        if (!fs.readFileSync(projectFile, 'utf8').includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                            try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (_) { }
                            isFirstCompile = true;
                        }
                    } catch (_) { }
                }

                if (isFirstCompile) {
                    socket.emit('terminal_output', 'Initializing compiler environment...\n');
                    try {
                        await ensureBaseTemplate();
                        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
                        fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                        await compileStudentCode(projectDir, code, extraFiles, releaseThisSlot);
                    } catch (err) {
                        console.warn('Fast template clone failed, falling back to dotnet new:', err.message);
                        exec(`dotnet new console -n verity_base --no-restore --framework ${targetFramework} -o "${projectDir}"`, { env: OFFLINE_DOTNET_ENV }, async (newErr) => {
                            if (newErr) {
                                sessionWorkspaces.delete(studentKey);
                                releaseThisSlot();
                                socket.emit('terminal_output', 'Error: Could not initialize .NET compiler.\n');
                                return socket.emit('process_exit', { code: 1 });
                            }
                            try {
                                fs.writeFileSync(path.join(projectDir, 'nuget.config'), OFFLINE_NUGET_CONFIG, 'utf8');
                                execSync(`dotnet restore "${path.join(projectDir, 'verity_base.csproj')}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                            } catch (_) { }
                            await compileStudentCode(projectDir, code, extraFiles, releaseThisSlot);
                        });
                    }
                } else {
                    await compileStudentCode(projectDir, code, extraFiles, releaseThisSlot);
                }
            } catch (error) {
                console.error('Compiler error:', error);
                socket.emit('terminal_output', `\n[Internal Server Error: ${error.message}]\n`);
                socket.emit('process_exit', { code: 1 });
            }
        });

        socket.on('terminal_input', (input) => {
            if (activeProcess && activeProcess.stdin) activeProcess.stdin.write(input + '\n');
        });

        socket.on('stop_code', () => {
            if (activeProcess) {
                const dirToClean = activeProcess._sandboxRunDir;
                const finish = activeProcess._finishSlot;
                try { killProcessTree(activeProcess); } catch (_) { }
                cleanupEphemeralSandboxDir(dirToClean);
                socket.emit('terminal_output', '\n[Process stopped by user]\n');
                socket.emit('process_exit', { code: 0 });
                activeProcess = null;
                if (typeof finish === 'function') finish();
            }
        });

        socket.on('run_test_cases', async (data) => {
            let acquiredTestKey = null;
            try {
                if (!socket.user) await authenticateSocket(socket, data?.token || socket.handshake.auth?.token);
                const { code, extraFiles = [], testCases = [], language } = data || {};
                if (!socket.user) {
                    return socket.emit('test_cases_results', {
                        results: (testCases || []).map(tc => ({
                            id: tc.id, status: 'error', passed: false, actualOutput: '',
                            expectedOutput: tc.expectedOutput || '', error: 'Authentication required to execute test cases. Please log in.'
                        }))
                    });
                }
                if (language && !['csharp', 'cs', 'c#'].includes(String(language).toLowerCase())) {
                    return socket.emit('test_cases_results', {
                        results: (testCases || []).map(tc => ({
                            id: tc.id, status: 'error', passed: false, actualOutput: '',
                            expectedOutput: tc.expectedOutput || '', error: `Compiler Error: Unsupported language "${language}". Verity Compiler strictly compiles C# (.NET SDK) only.`
                        }))
                    });
                }
                if (!Array.isArray(testCases) || testCases.length === 0) return socket.emit('test_cases_results', { results: [] });

                if (!dotnetManager.checkDotnetStatus(OFFLINE_DOTNET_ENV).installed) {
                    socket.emit('dotnet_missing', { error: 'DOTNET_NOT_INSTALLED' });
                    return socket.emit('test_cases_results', {
                        results: testCases.map(tc => ({
                            id: tc.id, status: 'error', passed: false, actualOutput: '',
                            expectedOutput: tc.expectedOutput || '', error: 'Microsoft .NET SDK is not installed on this PC. Please install .NET SDK to run tests.'
                        }))
                    });
                }

                const securityCheck = scanCSharpCode(code, extraFiles);
                if (!securityCheck.isSafe) {
                    await recordMaliciousScriptAttempt({ socket, data, securityCheck });
                    socket.emit('compiler_diagnostics', [{
                        severity: 'error', message: `[Security Violation] ${securityCheck.message}`,
                        startLineNumber: securityCheck.line || 1, startColumn: securityCheck.column || 1,
                        endLineNumber: securityCheck.line || 1, endColumn: (securityCheck.column || 1) + 12
                    }]);
                    return socket.emit('test_cases_results', {
                        results: (testCases || []).map(tc => ({
                            id: tc.id, status: 'error', passed: false, actualOutput: '',
                            expectedOutput: tc.expectedOutput || '', error: `Security Violation: ${securityCheck.message} (File: ${securityCheck.fileName}, Line ${securityCheck.line})`
                        }))
                    });
                }

                const studentKey = socket.user?.id
                    ? `u_${socket.user.id}`
                    : (socket.user?.email ? `e_${socket.user.email.replace(/[^a-zA-Z0-9]/g, '_')}` : `s_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`);

                if (!acquireUserCompileSlot(studentKey)) {
                    return socket.emit('test_cases_results', {
                        results: testCases.map(tc => ({
                            id: tc.id, status: 'error', passed: false, actualOutput: '',
                            expectedOutput: tc.expectedOutput || '', error: 'Compiler busy: Too many concurrent test runs for this account.'
                        }))
                    });
                }
                acquiredTestKey = studentKey;

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
                let buildOutput = '';

                if (ws.lastCompiledCode === code && fs.existsSync(dllPath)) {
                    socket.emit('compiler_diagnostics', []);
                } else {
                    try {
                        await ensureBaseTemplate();
                        if (!fs.existsSync(projectDir)) {
                            fs.mkdirSync(projectDir, { recursive: true });
                            fs.cpSync(COMPILER_BASE_DIR, projectDir, { recursive: true });
                        }
                    } catch (e) {
                        console.warn('Workspace prep failed for test cases:', e.message);
                    }

                    fs.writeFileSync(path.join(projectDir, 'Program.cs'), code || '', 'utf8');
                    const extraNames = new Set();
                    for (const ef of extraFiles) {
                        if (!ef || !ef.name || !ef.code) continue;
                        const safeName = ef.name.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                        if (safeName.toLowerCase() === 'program.cs') continue;
                        fs.writeFileSync(path.join(projectDir, safeName), ef.code || '', 'utf8');
                        extraNames.add(safeName);
                    }
                    try {
                        for (const f of fs.readdirSync(projectDir)) {
                            if (f.endsWith('.cs') && f !== 'Program.cs' && !extraNames.has(f)) {
                                try { fs.unlinkSync(path.join(projectDir, f)); } catch (_) { }
                            }
                        }
                    } catch (_) { }

                    const nugetFile = path.join(projectDir, 'nuget.config');
                    try {
                        if (!fs.existsSync(nugetFile) || fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                            fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                        }
                    } catch (_) { }

                    const treatWarningsAsErrors = await getTreatWarningsAsErrors();
                    const compilerConfig = getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles);
                    if (compilerConfig.mode === 'dotnet-build' && !fs.existsSync(path.join(projectDir, 'obj', 'project.assets.json'))) {
                        try {
                            execSync(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                        } catch (_) { }
                    }

                    const compileSuccess = await new Promise((resolve) => {
                        const bp = spawn(compilerConfig.command, compilerConfig.args, { cwd: projectDir, env: OFFLINE_DOTNET_ENV });
                        bp.stdout.on('data', d => { buildOutput += d.toString(); });
                        bp.stderr.on('data', d => { buildOutput += d.toString(); });
                        const timeout = setTimeout(() => { try { bp.kill(); } catch (_) { } resolve(false); }, 15000);
                        bp.on('close', exitCode => {
                            clearTimeout(timeout);
                            socket.emit('compiler_diagnostics', parseCompilerDiagnostics(buildOutput));
                            resolve(exitCode === 0 && fs.existsSync(dllPath));
                        });
                        bp.on('error', () => { clearTimeout(timeout); resolve(false); });
                    });

                    if (compileSuccess) {
                        ws.lastCompiledCode = code;
                    } else {
                        ws.lastCompiledCode = null;
                        return socket.emit('test_cases_results', {
                            results: testCases.map(tc => ({
                                id: tc.id, status: 'error', passed: false, actualOutput: '',
                                expectedOutput: tc.expectedOutput || '', error: buildOutput || 'Compilation failed. Please fix syntax or type errors in code.'
                            }))
                        });
                    }
                }

                const MAX_TEST_OUTPUT_BYTES = 128 * 1024;
                const MAX_CONCURRENT_TEST_CASES = 4;
                const runSingleTestCase = (tc) => new Promise((resolve) => {
                    let actual = '';
                    let runError = '';
                    let killed = false;
                    let totalBytes = 0;
                    const tcSandboxDir = createEphemeralSandboxDir('verity_sandbox_tc_');
                    const rp = spawn('dotnet', [dllPath], { cwd: tcSandboxDir, env: createSandboxedRunEnv(tcSandboxDir) });

                    const execTimeout = setTimeout(() => {
                        killed = true;
                        try { killProcessTree(rp); } catch (_) { }
                        cleanupEphemeralSandboxDir(tcSandboxDir);
                        const result = {
                            id: tc.id, status: 'error', passed: false,
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
                        } catch (_) { }
                    }
                    try { rp.stdin.end(); } catch (_) { }

                    const onChunk = (chunk, isErr) => {
                        if (killed) return;
                        totalBytes += chunk.length;
                        if (totalBytes > MAX_TEST_OUTPUT_BYTES) {
                            killed = true;
                            clearTimeout(execTimeout);
                            try { killProcessTree(rp); } catch (_) { }
                            cleanupEphemeralSandboxDir(tcSandboxDir);
                            const result = {
                                id: tc.id, status: 'error', passed: false,
                                actualOutput: actual.replace(/\r\n/g, '\n'),
                                expectedOutput: tc.expectedOutput || '',
                                error: 'Output exceeded 128 KB sandbox limit (infinite output loop detected)'
                            };
                            socket.emit('test_case_result', result);
                            resolve(result);
                            return;
                        }
                        if (isErr) runError += chunk.toString();
                        else actual += chunk.toString();
                    };

                    rp.stdout.on('data', d => onChunk(d, false));
                    rp.stderr.on('data', d => onChunk(d, true));
                    rp.on('close', () => {
                        clearTimeout(execTimeout);
                        cleanupEphemeralSandboxDir(tcSandboxDir);
                        if (killed) return;
                        const normActual = actual.replace(/\r\n/g, '\n').trim();
                        const normExpected = (tc.expectedOutput || '').replace(/\r\n/g, '\n').trim();
                        const passed = normActual === normExpected;
                        const result = {
                            id: tc.id, status: passed ? 'passed' : 'failed', passed,
                            actualOutput: actual.replace(/\r\n/g, '\n'),
                            expectedOutput: tc.expectedOutput || '',
                            error: runError || null
                        };
                        socket.emit('test_case_result', result);
                        resolve(result);
                    });
                    rp.on('error', (err) => {
                        clearTimeout(execTimeout);
                        cleanupEphemeralSandboxDir(tcSandboxDir);
                        if (killed) return;
                        const result = {
                            id: tc.id, status: 'error', passed: false,
                            actualOutput: actual.replace(/\r\n/g, '\n'),
                            expectedOutput: tc.expectedOutput || '',
                            error: err.message
                        };
                        socket.emit('test_case_result', result);
                        resolve(result);
                    });
                });

                const results = new Array(testCases.length);
                let nextIndex = 0;
                await Promise.all(Array.from(
                    { length: Math.min(MAX_CONCURRENT_TEST_CASES, testCases.length) },
                    async () => {
                        while (nextIndex < testCases.length) {
                            const idx = nextIndex++;
                            results[idx] = await runSingleTestCase(testCases[idx]);
                        }
                    }
                ));
                socket.emit('test_cases_results', { results });
            } catch (error) {
                console.error('Test case error:', error);
                socket.emit('test_cases_results', { results: [] });
            } finally {
                if (acquiredTestKey) releaseUserCompileSlot(acquiredTestKey);
            }
        });

        const activityCwCache = new Map();
        const activityClassCache = new Map();
        const ACTIVITY_META_TTL_MS = 30000;

        const handleStudentActivity = async (data, isExplicitEnter = false) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) {
                return socket.emit('error', { message: 'Authentication required.' });
            }
            if (!data || (!data.studentId && !data.name && !socket.user) || data.submitted) return;
            const { studentId, studentName } = resolveSocketStudentIdentity(socket, data);
            let classroomId = data.classroomId != null && data.classroomId !== 'default' ? String(data.classroomId) : 'none';
            const assignmentId = data.assignmentId != null && data.assignmentId !== 'default' ? String(data.assignmentId) : 'none';

            if ((!classroomId || classroomId === 'none' || classroomId === 'unassigned') && assignmentId !== 'none') {
                const cachedCw = activityCwCache.get(assignmentId);
                if (cachedCw && (Date.now() - cachedCw.ts) < ACTIVITY_META_TTL_MS) {
                    if (cachedCw.classroomId) classroomId = cachedCw.classroomId;
                } else {
                    try {
                        const foundCw = await db.get(`SELECT classroom_id FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?`, assignmentId, assignmentId);
                        const resolvedCid = foundCw && foundCw.classroom_id != null ? String(foundCw.classroom_id) : null;
                        if (activityCwCache.size > 500) activityCwCache.clear();
                        activityCwCache.set(assignmentId, { classroomId: resolvedCid, ts: Date.now() });
                        if (resolvedCid) classroomId = resolvedCid;
                    } catch (_) { }
                }
            }

            let classCode = null;
            if (classroomId && classroomId !== 'none') {
                const cacheKey = classroomId.toLowerCase();
                const cachedCls = activityClassCache.get(cacheKey);
                if (cachedCls && (Date.now() - cachedCls.ts) < ACTIVITY_META_TTL_MS) {
                    if (cachedCls.id) classroomId = cachedCls.id;
                    classCode = cachedCls.code;
                } else {
                    try {
                        const clsRow = await db.get(`SELECT id, code FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(code) = ?`, classroomId, classroomId, cacheKey);
                        const resolved = clsRow
                            ? { id: String(clsRow.id), code: clsRow.code ? String(clsRow.code) : null, ts: Date.now() }
                            : { id: null, code: null, ts: Date.now() };
                        if (activityClassCache.size > 500) activityClassCache.clear();
                        activityClassCache.set(cacheKey, resolved);
                        if (resolved.id) { classroomId = resolved.id; classCode = resolved.code; }
                    } catch (_) { }
                }
            }

            const studentKey = `${classroomId}:${assignmentId}:${studentId}`;
            try {
                const alreadySubmitted = await db.get(
                    `SELECT id FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (LOWER(student_name) = ? OR LOWER(student_name) = ?)`,
                    assignmentId, assignmentId, studentName.toLowerCase(), studentId.toLowerCase()
                );
                if (alreadySubmitted) {
                    delete activeStudents[studentKey];
                    return;
                }
            } catch (_) { }

            removeStudentFromPreviousActivities(studentId, studentName, studentKey);

            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            if (socket.data.roomName !== roomName) {
                if (socket.data.roomName) socket.leave(socket.data.roomName);
                socket.join(roomName);
                socket.data.roomName = roomName;
            }

            const existing = activeStudents[studentKey] || {};
            const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
            let mergedLogs = existingLogs;
            const hasIncomingLogs = Array.isArray(data.logs) && data.logs.length > 0;
            if (hasIncomingLogs) {
                const map = new Map();
                [...existingLogs, ...data.logs].forEach(l => {
                    if (!l) return;
                    const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
                    if (!map.has(k)) {
                        map.set(k, {
                            id: l.id || Date.now(), action: l.action || l.message || 'Violation',
                            message: l.message || l.action || 'Violation', time: l.time || '',
                            color: l.color || '#ef4444', studentId, studentName
                        });
                    }
                });
                mergedLogs = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
            }

            const resolvedAvatar = (data.avatar && String(data.avatar).trim()) ? data.avatar : (existing.avatar || '');
            const isNewOrSwitched = !existing.studentId || existing.classroomId !== classroomId || existing.assignmentId !== assignmentId;

            const updated = {
                ...existing, ...data, avatar: resolvedAvatar, studentId, id: studentId, name: studentName, studentName,
                classroomId, classCode: classCode || existing.classCode || null, assignmentId,
                logs: mergedLogs, status: 'Live', isLive: true, lastActive: Date.now()
            };

            activeStudents[studentKey] = updated;
            socket.data.studentKey = studentKey;
            socket.data.studentId = studentId;
            socket.data.studentName = studentName;
            socket.data.classroomId = classroomId;
            socket.data.assignmentId = assignmentId;

            // Omit static avatar & unchanged logs on high-frequency typing packets to save Render egress
            let emitPayload = updated;
            if (!isExplicitEnter && !isNewOrSwitched) {
                const { avatar: _omitAvatar, logs: _omitLogs, ...slimBase } = updated;
                emitPayload = hasIncomingLogs ? { ...slimBase, logs: mergedLogs } : slimBase;
            }

            io.to(roomName).emit('teacher_update_code', emitPayload);
            if (assignmentId && assignmentId !== 'none') io.to(`assignment:${assignmentId}`).emit('teacher_update_code', emitPayload);
            relayStudentActivity(emitPayload);
            broadcastActiveActivities();
        };

        socket.on('student_enter_activity', (data) => handleStudentActivity(data, true));
        socket.on('student_typing', (data) => handleStudentActivity(data, false));

        socket.on('proctor_alert', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) {
                return socket.emit('error', { message: 'Authentication required.' });
            }
            const isStudentCaller = !socket.isCloudRelay && socket.user && String(socket.user.role || '').toLowerCase() === 'student';
            if (data && (data.studentId || data.id || data.name || data.studentName || socket.data?.studentId || isStudentCaller)) {
                const { studentId, studentName } = resolveSocketStudentIdentity(socket, data);
                let classroomId = data.classroomId != null && data.classroomId !== 'default' ? String(data.classroomId) : null;
                let assignmentId = data.assignmentId != null && data.assignmentId !== 'default' ? String(data.assignmentId) : null;

                if (!classroomId || !assignmentId) {
                    if (socket.data.studentKey) {
                        const parts = socket.data.studentKey.split(':');
                        if (parts.length >= 3) {
                            classroomId = classroomId || (parts[0] !== 'default' ? parts[0] : null);
                            assignmentId = assignmentId || (parts[1] !== 'default' ? parts[1] : null);
                        }
                    } else {
                        const found = Object.values(activeStudents).find(s => s && (s.studentId === studentId || s.name === studentName));
                        if (found) {
                            classroomId = classroomId || (found.classroomId !== 'default' ? found.classroomId : null);
                            assignmentId = assignmentId || (found.assignmentId !== 'default' ? found.assignmentId : null);
                        }
                    }
                }
                classroomId = classroomId || 'none';
                assignmentId = assignmentId || 'none';

                const actionText = data.action || data.desc || 'Violation';
                const messageText = data.message || actionText;
                const timeText = data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                const colorVal = data.color || '#ef4444';
                const newLog = { id: data.id || Date.now(), action: actionText, message: messageText, time: timeText, color: colorVal, studentId, studentName };
                const studentKey = `${classroomId}:${assignmentId}:${studentId}`;

                try {
                    const alreadySubmitted = await db.get(
                        `SELECT id FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND (LOWER(student_name) = ? OR LOWER(student_name) = ?)`,
                        assignmentId, assignmentId, studentName.toLowerCase(), studentId.toLowerCase()
                    );
                    if (alreadySubmitted) {
                        delete activeStudents[studentKey];
                        await db.run(
                            'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            classroomId, assignmentId, studentId, studentName, newLog.action, newLog.message, newLog.time, newLog.color
                        ).catch(() => { });
                        return;
                    }
                } catch (_) { }

                const existing = activeStudents[studentKey] || { studentId, name: studentName, code: '', classroomId, assignmentId, logs: [], status: 'Live' };
                const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
                const isDup = existingLogs.some(l => l.action === newLog.action && (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000));
                const updatedLogs = isDup ? existingLogs : [newLog, ...existingLogs];

                activeStudents[studentKey] = {
                    ...existing, studentId, name: studentName, classroomId, assignmentId, logs: updatedLogs, status: existing.status || 'Live'
                };
                if (studentName !== studentId) {
                    const altKey = `${classroomId}:${assignmentId}:${studentName}`;
                    if (activeStudents[altKey]) activeStudents[altKey].logs = updatedLogs;
                }

                await db.run(
                    'INSERT INTO proctor_session_logs (classroom_id, assignment_id, student_id, student_name, action, message, time, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    String(classroomId), String(assignmentId), String(studentId), String(studentName), actionText, messageText, timeText, colorVal
                ).catch(() => { });

                const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
                const alertPayload = { ...data, id: newLog.id, studentId, name: studentName, action: actionText, message: messageText, time: timeText, color: colorVal, classroomId, assignmentId };
                io.to(roomName).emit('teacher_receive_alert', alertPayload);
                if (assignmentId && assignmentId !== 'none') io.to(`assignment:${assignmentId}`).emit('teacher_receive_alert', alertPayload);
                relayProctorAlert(alertPayload);
            }

            try {
                const key = todayKey();
                const actionStr = (data?.action || '').toLowerCase();
                const descStr = (data?.desc || '').toLowerCase();
                const isCrash = Boolean(data?.isCrash) || actionStr.includes('crash') || descStr.includes('crash');
                const isSystemExit = !isCrash && (actionStr.includes('system exit') || descStr.includes('system exit') || descStr.includes('exited system') || descStr.includes('exited the system'));
                const isExitTab = !isCrash && !isSystemExit && (actionStr.includes('tab') || actionStr.includes('exit') || actionStr.includes('blur') || descStr.includes('tab') || descStr.includes('blur'));
                const isCopyPaste = !isCrash && (actionStr.includes('paste') || actionStr.includes('clipboard') || actionStr.includes('copy'));
                const isAltTabCopyPaste = !isCrash && (isExitTab || isCopyPaste || isSystemExit);

                if (isAltTabCopyPaste) {
                    await db.run('INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 0, 1) ON CONFLICT(date_string) DO UPDATE SET alt_tab_copy_paste_count = COALESCE(security_flags.alt_tab_copy_paste_count, 0) + 1', key);
                } else {
                    await db.run('INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1', key);
                }

                const nowIso = new Date().toISOString();
                if (data && (data.studentId || data.name || data.email || isStudentCaller)) {
                    const userName = isStudentCaller
                        ? (socket.user.name || socket.user.email || String(socket.user.id || 'Student'))
                        : (data.name || data.email || data.studentId);
                    let logType = 'Security Flag Alert';
                    let logSeverity = 'High';
                    if (isCrash) logType = 'System Crash Violation';
                    else if (isSystemExit) { logType = 'System Exit Violation'; logSeverity = 'Warning'; }
                    else if (isCopyPaste) logType = 'Copy/Paste Violation';
                    else if (isExitTab) { logType = 'Exit Tab Violation'; logSeverity = 'Warning'; }

                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, userName, logType, logSeverity,
                        data.desc || (data.classroomId ? `${data.action || 'Violation alert'} in classroom ${data.classroomId}` : (data.action || 'Violation alert'))
                    );
                }

                io.to('role:admin').emit('admin_security_alert', { ...data, isCrash, isAltTabCopyPaste, isSystemExit, timestamp: nowIso });
                io.to('role:admin').emit('admin_stats_update');
            } catch (e) { console.error(e); }
        });

        socket.on('submit_exam', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) {
                return socket.emit('error', { message: 'Authentication required.' });
            }
            if (!data) return;
            const { canonicalName: authenticatedName, canonicalId: authenticatedId, canonicalEmail, aliases } = await resolveCanonicalStudent(
                socket.user, data.studentName || data.studentId || 'Unknown', data.studentId, data.email || data.studentEmail || ''
            );
            const classroomId = data.classroomId || 'none';
            const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';

            const strictWarnings = await getTreatWarningsAsErrors();
            const payload = {
                ...data, studentName: authenticatedName, studentId: authenticatedId,
                studentEmail: canonicalEmail || data.studentEmail || data.email || '',
                strictWarningsEnforced: strictWarnings
            };

            const targetId = String(data.studentId || authenticatedId || '');
            const targetName = String(data.studentName || authenticatedName || '').trim().toLowerCase();
            const aliasSet = new Set(aliases);

            for (const [key, student] of Object.entries(activeStudents)) {
                if (!student) continue;
                const curId = String(student.studentId || student.id || '');
                const curName = String(student.name || student.studentName || '').trim().toLowerCase();
                if ((targetId && (curId === targetId || key.endsWith(`:${targetId}`))) || (targetName && (curName === targetName || key.endsWith(`:${targetName}`))) || aliasSet.has(curName)) {
                    delete activeStudents[key];
                }
            }
            removeStudentFromPreviousActivities(targetId, targetName);
            removeStudentFromPreviousActivities(authenticatedId, authenticatedName);
            broadcastActiveActivities();

            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            socket.to(roomName).emit('teacher_receive_submission', payload);
            if (assignmentId && assignmentId !== 'unassigned') socket.to(`assignment:${assignmentId}`).emit('teacher_receive_submission', payload);
            socket.to(roomName).emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
            if (assignmentId && assignmentId !== 'unassigned') socket.to(`assignment:${assignmentId}`).emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
            io.to('role:teacher').emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
            io.to('role:admin').emit('teacher_student_left', { studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });
            relaySubmitExam(payload);
            relayStudentLeft({ studentId: targetId, studentName: authenticatedName, studentIdNum: authenticatedId, reason: 'submitted', assignmentId, classroomId });

            try {
                for (const alias of aliases) {
                    await db.run('DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))', assignmentId, alias).catch(() => { });
                    const aliasNorm = String(alias || '').trim().toLowerCase();
                    if (aliasNorm && aliasNorm !== String(authenticatedName).trim().toLowerCase()) {
                        await db.recordSyncDeletion('submissions', `${assignmentId}_${aliasNorm}`).catch(() => { });
                    }
                }
                const historyStr = JSON.stringify(Array.isArray(data.codeHistory) ? data.codeHistory : []);
                await db.run('INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)', assignmentId, authenticatedName, historyStr, new Date().toISOString());
                await db.clearSyncDeletion('submissions', `${assignmentId}_${String(authenticatedName).trim().toLowerCase()}`).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
            } catch (e) { console.error(e); }
        });

        socket.on('unsubmit_exam', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) {
                return socket.emit('unsubmit_error', { message: 'Authentication required.', assignmentId: data?.assignmentId });
            }
            if (!data) return;
            const assignmentId = data.assignmentId != null ? String(data.assignmentId) : 'unassigned';
            const isTeacherOrAdmin = socket.user && ['Teacher', 'Admin'].includes(socket.user.role);
            if (!isTeacherOrAdmin && assignmentId !== 'unassigned') {
                try {
                    const cwRow = await db.get('SELECT description FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?', assignmentId, assignmentId);
                    if (cwRow && cwRow.description) {
                        const meta = JSON.parse(cwRow.description);
                        if (meta.disableBack || meta.disable_back) {
                            socket.emit('unsubmit_error', { message: 'Unsubmitting is not permitted for this activity.', assignmentId });
                            return;
                        }
                    }
                } catch (_) { }
            }
            const { canonicalName: studentName, canonicalId: studentId, aliases } = await resolveCanonicalStudent(
                isTeacherOrAdmin ? null : socket.user, data.studentName || data.studentId || 'Unknown', data.studentId, data.email || data.studentEmail || ''
            );
            const classroomId = data.classroomId || 'none';
            const studentKey = `${classroomId}:${assignmentId}:${studentId || studentName}`;
            if (activeStudents[studentKey]) activeStudents[studentKey] = { ...activeStudents[studentKey], status: 'Active' };

            try {
                for (const alias of aliases) {
                    await db.run(`DELETE FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))`, assignmentId, String(assignmentId), alias).catch(() => { });
                    await db.recordSyncDeletion('submissions', `${assignmentId}_${String(alias).trim().toLowerCase()}`).catch(() => { });
                }
                if (studentName) await db.recordSyncDeletion('submissions', `${assignmentId}_${String(studentName).trim().toLowerCase()}`).catch(() => { });
                try { db.triggerSync(); } catch (_) { }
            } catch (e) { console.error(e); }

            const safeStudentId = String(studentId || '');
            const roomName = `classroom:${classroomId}:assignment:${assignmentId}`;
            socket.to(roomName).emit('teacher_student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
            if (assignmentId && assignmentId !== 'unassigned') socket.to(`assignment:${assignmentId}`).emit('teacher_student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
            socket.emit('student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
            socket.broadcast.emit('student_unsubmitted', { studentName, assignmentId, studentId: safeStudentId });
            relayUnsubmitExam({ studentName, assignmentId, studentId: safeStudentId, classroomId });
        });

        socket.on('student_terminal_update', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) return;
            let payload = data;
            if (!socket.isCloudRelay && socket.user && String(socket.user.role || '').toLowerCase() === 'student' && data) {
                const { studentId, studentName } = resolveSocketStudentIdentity(socket, data);
                payload = { ...data, studentId, id: studentId, name: studentName, studentName };
            }
            if (payload?.classroomId && payload?.assignmentId) io.to(`classroom:${payload.classroomId}:assignment:${payload.assignmentId}`).emit('teacher_terminal_update', payload);
            else if (payload?.assignmentId && payload.assignmentId !== 'none') io.to(`assignment:${payload.assignmentId}`).emit('teacher_terminal_update', payload);
            relayTerminalUpdate(payload);
        });

        socket.on('student_leave_workspace', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) return;
            if (activeProcess) {
                const finish = activeProcess._finishSlot;
                try { killProcessTree(activeProcess); } catch (_) { }
                activeProcess = null;
                if (typeof finish === 'function') finish();
            }
            const isStudentCaller = !socket.isCloudRelay && socket.user && String(socket.user.role || '').toLowerCase() === 'student';
            const studentId = isStudentCaller ? String(socket.user.id || socket.data.studentId || data?.studentId || '') : (socket.data.studentId || data?.studentId);
            const studentName = isStudentCaller ? String(socket.user.name || socket.user.email || socket.data.studentName || '').trim() : (data?.name || data?.studentName || socket.user?.name || socket.data.studentName);
            const classroomId = data?.classroomId || socket.data.classroomId;
            const assignmentId = data?.assignmentId || socket.data.assignmentId;

            if (socket.data.studentKey) delete activeStudents[socket.data.studentKey];
            if (studentId || studentName) removeStudentFromPreviousActivities(studentId, studentName);

            const roomName = socket.data.roomName || (classroomId && assignmentId ? `classroom:${classroomId}:assignment:${assignmentId}` : null);
            const leftPayload = { studentId, studentName, classroomId, assignmentId, reason: 'left_workspace' };
            if (roomName) {
                io.to(roomName).emit('teacher_student_left', leftPayload);
                socket.leave(roomName);
            }
            io.to('role:teacher').emit('teacher_student_left', leftPayload);
            io.to('role:admin').emit('teacher_student_left', leftPayload);
            relayStudentLeft(leftPayload);

            socket.data.studentKey = null;
            socket.data.studentId = null;
            socket.data.studentName = null;
            socket.data.classroomId = null;
            socket.data.assignmentId = null;
            socket.data.roomName = null;
            broadcastActiveActivities();
        });

        socket.on('teacher_student_left', async (data) => {
            if (!(await ensureSocketAuthOrRelay(socket, data))) return;
            if (!data) return;
            const targetId = String(data.studentId || data.studentIdNum || '');
            const targetName = String(data.studentName || data.name || '');
            if (!targetId && !targetName) return;

            if (socket.user && String(socket.user.role || '').toLowerCase() === 'student') {
                const selfId = String(socket.user.id || '');
                const selfName = String(socket.user.name || '').trim().toLowerCase();
                if (targetId && selfId && targetId !== selfId && targetName.trim().toLowerCase() !== selfName) return;
            }

            removeStudentFromPreviousActivities(targetId, targetName);
            if (data.classroomId && data.assignmentId) io.to(`classroom:${data.classroomId}:assignment:${data.assignmentId}`).emit('teacher_student_left', data);
            if (data.assignmentId && data.assignmentId !== 'none') io.to(`assignment:${data.assignmentId}`).emit('teacher_student_left', data);
            broadcastActiveActivities();
        });

        socket.on('disconnect', async () => {
            if (activeProcess) {
                const finish = activeProcess._finishSlot;
                try { killProcessTree(activeProcess); } catch (_) { }
                activeProcess = null;
                if (typeof finish === 'function') finish();
            }
            const studentId = socket.data.studentId || socket.user?.id;
            const studentName = socket.data.studentName || socket.user?.name;
            const classroomId = socket.data.classroomId;
            const assignmentId = socket.data.assignmentId;

            if (socket.data.studentKey) delete activeStudents[socket.data.studentKey];
            if (studentId || studentName) removeStudentFromPreviousActivities(studentId, studentName);

            const leftPayload = { studentId, studentName, classroomId, assignmentId, reason: 'disconnected' };
            if (socket.data.roomName) io.to(socket.data.roomName).emit('teacher_student_left', leftPayload);
            io.to('role:teacher').emit('teacher_student_left', leftPayload);
            io.to('role:admin').emit('teacher_student_left', leftPayload);
            broadcastActiveActivities();

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
                        await db.run('INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1', key);
                        await db.run(
                            'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                            nowIso, userName, 'System Exit Violation', 'Warning',
                            `Student exited the system: ${userName} closed or disconnected application (outside workspace)`
                        );
                        io.to('role:admin').emit('admin_security_alert', {
                            user: userName, name: userName, studentId: socket.user.id || userName,
                            type: 'System Exit Violation', desc: `Student exited the system: ${userName} closed or disconnected application`,
                            severity: 'Warning', isAltTabCopyPaste: false, isSystemExit: true, timestamp: nowIso
                        });
                        io.to('role:admin').emit('admin_stats_update');
                    }
                } catch (_) { }
            }
        });
    });
}

module.exports = { registerSocketHandlers };
