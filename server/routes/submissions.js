const { scanCSharpCode } = require('../csharpSecurityScanner');
const { todayKey } = require('../utils/serverHelpers');

/**
 * Registers student submissions, proctor session logs, grading endpoints,
 * and classroom submission counts.
 */
function registerSubmissionRoutes(app, { db, io, IS_RENDER_CLOUD, authMiddleware, classroomHelpers }) {
    const { authenticateToken, requireRole } = authMiddleware;
    const { checkAssignmentAccess, checkClassroomAccess, resolveCanonicalStudent } = classroomHelpers;

    app.get('/student/submissions', authenticateToken, requireRole('Student'), async (req, res) => {
        try {
            const canonical = await resolveCanonicalStudent(req.user);
            const candidates = Array.from(new Set([
                req.user.name,
                req.user.email,
                canonical?.name,
                canonical?.email
            ].filter(Boolean).map(v => String(v).trim().toLowerCase())));

            if (candidates.length === 0) return res.status(200).json({ submissions: [] });

            const placeholders = candidates.map(() => '?').join(', ');
            const rows = await db.all(
                `SELECT assignment_id, submittedAt FROM submissions WHERE LOWER(TRIM(student_name)) IN (${placeholders})`,
                ...candidates
            );
            const normalized = (rows || []).map(r => ({
                assignment_id: r.assignment_id,
                submittedAt: r.submittedAt || r.submittedat || null
            }));
            res.status(200).json({ submissions: normalized });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/submissions/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin', 'Student'), async (req, res) => {
        try {
            if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
                return res.status(403).json({ message: 'Access denied' });
            }
            const allRows = await db.all('SELECT * FROM submissions WHERE assignment_id = ?', req.params.assignmentId);
            const normalizeStudentSubName = (rawName) => String(rawName || '').trim();

            let filteredRows = allRows || [];
            if (req.user.role === 'Student') {
                const { aliases } = await resolveCanonicalStudent(req.user);
                const aliasLookup = new Set(aliases);
                filteredRows = filteredRows.filter(s => {
                    const sLower = String(s.student_name || '').trim().toLowerCase();
                    const normLower = normalizeStudentSubName(s.student_name).toLowerCase();
                    return aliasLookup.has(sLower) || aliasLookup.has(normLower);
                });
            }

            const dedupedMap = new Map();
            for (const s of filteredRows) {
                const normName = normalizeStudentSubName(s.student_name);
                const key = normName.toLowerCase();
                let history = [];
                try { history = JSON.parse(s.history); } catch { }
                const lastCode = Array.isArray(history) && history.length > 0 ? history[history.length - 1]?.code : '';
                const formatted = {
                    ...s,
                    student_name: normName,
                    studentName: normName,
                    history,
                    finalCode: lastCode
                };
                const existing = dedupedMap.get(key);
                if (!existing) {
                    dedupedMap.set(key, formatted);
                } else {
                    const newTime = new Date(formatted.submittedAt || formatted.submittedat || 0).getTime();
                    const oldTime = new Date(existing.submittedAt || existing.submittedat || 0).getTime();
                    const newLen = Array.isArray(formatted.history) ? formatted.history.length : 0;
                    const oldLen = Array.isArray(existing.history) ? existing.history.length : 0;
                    if (newTime > oldTime || (newTime === oldTime && newLen >= oldLen)) {
                        dedupedMap.set(key, formatted);
                    }
                }
            }

            const submissions = Array.from(dedupedMap.values());
            const isOfflineFallback = !IS_RENDER_CLOUD && !db.isPostgres && process.env.IS_LAN_HOST !== 'true';
            res.status(200).json({ submissions, isOfflineFallback });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/proctor-logs/:assignmentId', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            if (!(await checkAssignmentAccess(req, req.params.assignmentId))) {
                return res.status(403).json({ message: 'Access denied' });
            }
            const assignmentId = String(req.params.assignmentId);
            const classroomId = req.query.classroomId ? String(req.query.classroomId) : null;
            let logs = [];
            if (classroomId && classroomId !== 'none' && classroomId !== 'undefined' && classroomId !== 'default') {
                logs = await db.all(
                    `SELECT * FROM proctor_session_logs 
                     WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) 
                       AND (classroom_id = ? OR CAST(classroom_id AS TEXT) = ? OR classroom_id IS NULL) 
                     ORDER BY id ASC`,
                    assignmentId, assignmentId, classroomId, classroomId
                ).catch(() => []);
            } else {
                logs = await db.all(
                    `SELECT * FROM proctor_session_logs 
                     WHERE assignment_id = ? OR CAST(assignment_id AS TEXT) = ?
                     ORDER BY id ASC`,
                    assignmentId, assignmentId
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
            const { canonicalName: name, aliases } = await resolveCanonicalStudent(req.user);

            if (finalCode) {
                const secCheck = scanCSharpCode(finalCode);
                if (!secCheck.isSafe) {
                    const nowIso = new Date().toISOString();
                    const desc = `Blocked malicious script in submitted assignment #${assignmentId}: [${secCheck.rule}] ${secCheck.message}`;
                    await db.run(
                        'INSERT INTO audit_logs (timestamp, "user", type, severity, "desc") VALUES (?, ?, ?, ?, ?)',
                        nowIso, name, 'Malicious Script Attempt', 'High', desc
                    ).catch(() => { });
                    await db.run(
                        `INSERT INTO security_flags (date_string, count, alt_tab_copy_paste_count) VALUES (?, 1, 0) ON CONFLICT(date_string) DO UPDATE SET count = COALESCE(security_flags.count, 0) + 1`,
                        todayKey()
                    ).catch(() => { });
                    io.emit('admin_security_alert', {
                        user: name, name, studentId: name, type: 'Malicious Script Attempt',
                        severity: 'High', desc, isMaliciousScript: true, timestamp: nowIso
                    });
                    io.emit('admin_stats_update');
                    return res.status(400).json({ message: `Submission rejected: Malicious code detected [${secCheck.rule}]. This incident has been logged in Security Audit Logs.` });
                }
            }

            const historyStr = JSON.stringify(Array.isArray(codeHistory) && codeHistory.length > 0 ? codeHistory : [{ time: Date.now(), code: finalCode || '' }]);

            if (!IS_RENDER_CLOUD && !db.isPostgres) {
                try {
                    const existingCw = await db.get('SELECT classroom_id FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?', assignmentId, String(assignmentId));
                    const stubClassroomId = existingCw?.classroom_id || req.body?.classroomId || 1;
                    if (!existingCw) {
                        await db.run('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)', stubClassroomId, `Classroom ${stubClassroomId}`).catch(() => { });
                        await db.run('INSERT OR IGNORE INTO classwork (id, classroom_id, title) VALUES (?, ?, ?)', assignmentId, stubClassroomId, `Assignment ${assignmentId}`).catch(() => { });
                    }
                    const sEmail = (req.user?.email || req.body?.studentEmail || `${name}@verity.local`).trim().toLowerCase();
                    await db.run(
                        'INSERT OR IGNORE INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at) VALUES (?, ?, ?, ?, ?)',
                        stubClassroomId, req.user?.id || null, name, sEmail, new Date().toISOString()
                    ).catch(() => { });
                } catch (_) { }
            }

            for (const alias of aliases) {
                await db.run('DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))', assignmentId, alias).catch(() => { });
            }
            await db.run(
                'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
                assignmentId, name, historyStr, new Date().toISOString()
            );
            await db.clearSyncDeletion('submissions', `${assignmentId}_${String(name).trim().toLowerCase()}`);

            try { db.triggerSync(); } catch (_) { }
            io.emit('submission_updated', { assignmentId, studentName: name });
            res.status(200).json({ message: 'Submission saved', studentName: name });
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
            const sLower = (studentName || '').trim().toLowerCase();
            const isTeacherOrAdmin = req.user.role === 'Teacher' || req.user.role === 'Admin';
            const { canonicalName, aliases } = await resolveCanonicalStudent(
                isTeacherOrAdmin ? null : req.user,
                studentName
            );
            const aliasSet = new Set(aliases);
            const namesToDelete = new Set([sLower, ...aliases]);

            if (req.user.role === 'Student') {
                const cwRow = await db.get(
                    'SELECT description FROM classwork WHERE id = ? OR CAST(id AS TEXT) = ?',
                    req.params.assignmentId, String(req.params.assignmentId)
                ).catch(() => null);
                if (cwRow && cwRow.description) {
                    try {
                        const meta = JSON.parse(cwRow.description);
                        if (meta.disableBack || meta.disable_back) {
                            return res.status(403).json({ message: 'Unsubmitting is not permitted for this activity.' });
                        }
                    } catch (_) { }
                }

                const uId = String(req.user.id || '');
                let isSelf = aliasSet.has(sLower) || studentName === uId || sLower === uId;
                if (!isSelf) {
                    const userAliases = await resolveCanonicalStudent(req.user);
                    (userAliases?.aliases || []).forEach(a => aliasSet.add(a));
                    if (req.user.name) aliasSet.add(req.user.name.toLowerCase().trim());
                    if (req.user.email) aliasSet.add(req.user.email.toLowerCase().trim());
                    if (req.user.id != null) aliasSet.add(String(req.user.id).toLowerCase().trim());
                    isSelf = aliasSet.has(sLower) || studentName === uId || sLower === uId;
                    if (!isSelf) {
                        return res.status(403).json({ message: 'Access denied: You can only delete your own submission.' });
                    }
                }
                if (req.user.name) namesToDelete.add(req.user.name.trim().toLowerCase());
                if (req.user.email) namesToDelete.add(req.user.email.trim().toLowerCase());
                if (req.user.id != null) namesToDelete.add(String(req.user.id).trim().toLowerCase());
            }

            for (const alias of namesToDelete) {
                if (!alias) continue;
                await db.run(
                    `DELETE FROM submissions WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?) AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))`,
                    req.params.assignmentId, String(req.params.assignmentId), alias
                ).catch(() => { });
                await db.recordSyncDeletion('submissions', `${req.params.assignmentId}_${String(alias).trim().toLowerCase()}`);
            }
            try { db.triggerSync(); } catch (_) { }
            const deletedStudentName = canonicalName || studentName;
            io.emit('submission_deleted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName });
            io.emit('student_unsubmitted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName, studentId: String(req.user?.id || '') });
            io.emit('teacher_student_unsubmitted', { assignmentId: req.params.assignmentId, studentName: deletedStudentName, studentId: String(req.user?.id || '') });
            res.status(200).json({ message: 'Submission deleted' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

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
                if (roleLower === 'student') {
                    const isStudentGrade = (
                        r.student_id === String(req.user.id) ||
                        r.student_id === req.user.name ||
                        r.student_id === req.user.email ||
                        (req.user.name && r.student_id.toLowerCase() === req.user.name.toLowerCase()) ||
                        (req.user.email && r.student_id.toLowerCase() === req.user.email.toLowerCase())
                    );
                    if (isStudentGrade) gradesMap[r.student_id] = { grade: r.grade, feedback: r.feedback, gradedAt: gradedAtVal };
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
                INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                    grade = excluded.grade, feedback = excluded.feedback,
                    graded_at = excluded.graded_at, updated_at = excluded.updated_at
            `, aId, sId, gVal, fbVal, now, now);
            await db.clearSyncDeletion('grades', `${aId}_${sId.trim().toLowerCase()}`);
            try { db.triggerSync(); } catch (_) { }

            if (io) {
                io.emit('grade_updated', { assignmentId: aId, studentId: sId, grade: gVal, feedback: fbVal, gradedAt: now });
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
                if (!g.studentId) continue;
                const sId = String(g.studentId);
                const gVal = String(g.grade ?? '100');
                const fbVal = g.feedback || '';
                await db.run(`
                    INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                        grade = excluded.grade, feedback = excluded.feedback,
                        graded_at = excluded.graded_at, updated_at = excluded.updated_at
                `, aId, sId, gVal, fbVal, now, now);
                await db.clearSyncDeletion('grades', `${aId}_${sId.trim().toLowerCase()}`);
                savedList.push({ studentId: sId, grade: gVal, feedback: fbVal, gradedAt: now });
            }
            try { db.triggerSync(); } catch (_) { }
            if (io && savedList.length > 0) io.emit('bulk_grades_updated', { assignmentId: aId, grades: savedList });
            res.status(200).json({ message: 'Bulk grades saved', count: savedList.length });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.delete('/grades/:assignmentId/:studentName', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
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
            await db.recordSyncDeletion('grades', `${aId}_${String(studentName).trim().toLowerCase()}`);
            try { db.triggerSync(); } catch (_) { }
            if (io) io.emit('grade_deleted', { assignmentId: aId, studentId: studentName });
            res.status(200).json({ message: 'Grade deleted' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/submission-counts', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const cid = req.query.classroomId;
            const hasSpecificClassroom = Boolean(cid && cid !== 'default' && cid !== 'all');
            if (hasSpecificClassroom && !(await checkClassroomAccess(req, cid))) {
                return res.status(403).json({ message: 'Access denied' });
            }

            const numCid = hasSpecificClassroom && !isNaN(Number(cid)) ? Number(cid) : 0;
            const subs = hasSpecificClassroom
                ? await db.all(`
                    SELECT s.assignment_id, COUNT(DISTINCT LOWER(TRIM(s.student_name))) as c
                    FROM submissions s
                    JOIN classwork cw ON CAST(s.assignment_id AS TEXT) = CAST(cw.id AS TEXT)
                    WHERE cw.classroom_id = ? OR CAST(cw.classroom_id AS TEXT) = CAST(? AS TEXT)
                    GROUP BY s.assignment_id
                `, numCid, String(cid))
                : req.user?.role === 'Admin'
                    ? await db.all('SELECT assignment_id, COUNT(DISTINCT LOWER(TRIM(student_name))) as c FROM submissions GROUP BY assignment_id')
                    : await db.all(`
                        SELECT s.assignment_id, COUNT(DISTINCT LOWER(TRIM(s.student_name))) as c 
                        FROM submissions s
                        JOIN classwork cw ON CAST(s.assignment_id AS TEXT) = CAST(cw.id AS TEXT)
                        JOIN classrooms cr ON cw.classroom_id = cr.id
                        WHERE (cr.instructor_email IS NOT NULL AND cr.instructor_email != '' AND LOWER(cr.instructor_email) = ?)
                           OR ((cr.instructor_email IS NULL OR cr.instructor_email = '') AND cr.instructor IS NOT NULL AND cr.instructor != '' AND LOWER(cr.instructor) = ?)
                        GROUP BY s.assignment_id
                    `, (req.user.email || '').trim().toLowerCase(), (req.user.name || '').trim().toLowerCase());

            const counts = {};
            subs.forEach(s => { counts[s.assignment_id] = Number(s.c); });

            let studentCount = 0;
            if (hasSpecificClassroom) {
                const enrolledRow = await db.get(`
                    SELECT COUNT(DISTINCT COALESCE(CAST(student_id AS TEXT), LOWER(TRIM(student_email)), LOWER(TRIM(student_name)))) as c 
                    FROM enrollments WHERE classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT)
                `, numCid, String(cid));
                studentCount = enrolledRow ? Number(enrolledRow.c) : 0;
            } else if (req.user?.role !== 'Admin') {
                const enrolledRow = await db.get(`
                    SELECT COUNT(DISTINCT COALESCE(CAST(e.student_id AS TEXT), LOWER(TRIM(e.student_email)), LOWER(TRIM(e.student_name)))) as c 
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
}

module.exports = { registerSubmissionRoutes };
