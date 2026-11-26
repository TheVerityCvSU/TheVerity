/**
 * Registers classroom CRUD, archival, settings/theme updates, roster listing,
 * enrollment, and student join-by-code routes.
 */
function registerClassroomRoutes(app, { db, io, authMiddleware, classroomHelpers }) {
    const { authenticateToken, requireRole } = authMiddleware;
    const { parseClassroomSettings, parseArchivedBool, checkClassroomAccess } = classroomHelpers;

    async function resolveClassroomInstructor(classroom) {
        let instName = (classroom?.instructor && classroom.instructor.trim()) || '';
        let instEmail = (classroom?.instructor_email && classroom.instructor_email.trim()) || (classroom?.instructorEmail && classroom.instructorEmail.trim()) || '';

        let realTeacher = null;
        if (instEmail) {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(email) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instEmail).catch(() => null);
            if (!realTeacher) realTeacher = await db.get('SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(email) = LOWER(?)', instEmail).catch(() => null);
        }
        if (!realTeacher && instName && instName !== 'Instructor') {
            realTeacher = await db.get("SELECT id, name, email, avatar, role FROM users WHERE LOWER(name) = LOWER(?) AND (LOWER(role) = 'teacher' OR LOWER(role) = 'admin')", instName).catch(() => null);
            if (!realTeacher) realTeacher = await db.get('SELECT id, name, email, avatar, role FROM admin_users WHERE LOWER(name) = LOWER(?)', instName).catch(() => null);
        }
        if (realTeacher) {
            instName = realTeacher.name;
            instEmail = realTeacher.email;
        }
        return { instName, instEmail, realTeacher };
    }

    app.get('/classrooms', authenticateToken, async (req, res) => {
        try {
            let rawClassrooms = [];
            const roleLower = String(req.user?.role || '').toLowerCase();
            if (roleLower === 'student') {
                const studentEmail = (req.user.email || '').trim().toLowerCase();
                const studentId = req.user.id || 0;
                rawClassrooms = await db.all(`
                    SELECT * FROM (
                        SELECT DISTINCT c.* FROM classrooms c
                        INNER JOIN enrollments e ON e.classroom_id = c.id
                        WHERE (e.student_email IS NOT NULL AND LOWER(TRIM(e.student_email)) = ?)
                           OR (e.student_id IS NOT NULL AND (e.student_id = ? OR CAST(e.student_id AS TEXT) = CAST(? AS TEXT)))
                    ) sub
                    ORDER BY LOWER(sub.name) ASC, sub.id ASC
                `, studentEmail, studentId, String(studentId));

                if (studentEmail && studentId) {
                    db.run(
                        'UPDATE enrollments SET student_email = ? WHERE (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)) AND (student_email IS NULL OR LOWER(TRIM(student_email)) != ?)',
                        studentEmail, studentId, String(studentId), studentEmail
                    ).catch(() => { });
                    db.run(
                        'UPDATE enrollments SET student_id = ? WHERE (student_email IS NOT NULL AND LOWER(TRIM(student_email)) = ?) AND (student_id IS NULL OR student_id != ?)',
                        studentId, studentEmail, studentId
                    ).catch(() => { });
                }
            } else if (roleLower === 'teacher' || roleLower === 'instructor') {
                const teacherEmail = (req.user.email || '').trim().toLowerCase();
                const teacherName = (req.user.name || '').trim().toLowerCase();
                rawClassrooms = await db.all(`
                    SELECT * FROM classrooms
                    WHERE (instructor_email IS NOT NULL AND instructor_email != '' AND (LOWER(instructor_email) = ? OR LOWER(instructor_email) LIKE ?))
                       OR (instructor IS NOT NULL AND instructor != '' AND (TRIM(LOWER(instructor)) = ? OR TRIM(LOWER(instructor)) LIKE ?))
                       OR (instructor_email IS NULL OR instructor_email = '' OR instructor IS NULL OR instructor = '' OR instructor = 'Instructor')
                    ORDER BY LOWER(name) ASC, id ASC
                `, teacherEmail, `%${teacherEmail}%`, teacherName, `%${teacherName}%`);

                if (teacherEmail && teacherName) {
                    db.run(
                        'UPDATE classrooms SET instructor_email = ? WHERE (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = ?) AND (instructor_email IS NULL OR instructor_email = \'\' OR LOWER(instructor_email) != ?)',
                        teacherEmail, teacherName, teacherEmail
                    ).catch(() => { });
                }
            } else {
                rawClassrooms = await db.all('SELECT * FROM classrooms ORDER BY LOWER(name) ASC, id ASC');
            }

            const validClassrooms = rawClassrooms.filter(c => {
                if (!c || !c.name) return false;
                const isPhantom = /^Classroom \d+$/i.test(c.name.trim()) && (!c.section || !c.section.trim()) && (!c.subject || !c.subject.trim());
                return !isPhantom;
            });

            const formatted = await Promise.all(validClassrooms.map(async c => {
                const { instName, instEmail, realTeacher } = await resolveClassroomInstructor(c);
                let parsedTheme = null;
                if (c.theme) {
                    try { parsedTheme = typeof c.theme === 'string' ? JSON.parse(c.theme) : c.theme; } catch { parsedTheme = null; }
                }
                return {
                    ...c,
                    archived: parseArchivedBool(c.archived),
                    description: c.description || '',
                    settings: parseClassroomSettings(c.settings),
                    theme: parsedTheme,
                    instructor: instName || 'Instructor',
                    instructorEmail: instEmail,
                    instructorAvatar: realTeacher?.avatar || null
                };
            }));

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
                let existing = null;
                if (c.id) {
                    existing = await db.get('SELECT id, instructor, instructor_email, name, archived, description, settings FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', c.id, String(c.id));
                    const isPlaceholder = existing && (
                        !existing.instructor_email ||
                        !existing.instructor ||
                        existing.instructor === 'Instructor' ||
                        (existing.name && /^Classroom \d+$/i.test(existing.name.trim()))
                    );
                    if (existing && !isPlaceholder && !(await checkClassroomAccess(req, c.id))) continue;
                }
                if (!c.name || !String(c.name).trim()) continue;

                const instName = c.instructor || req.user.name || 'Instructor';
                const instEmail = c.instructorEmail || c.instructor_email || (req.user.role === 'Teacher' ? req.user.email : '');
                const themeStr = c.theme ? (typeof c.theme === 'object' ? JSON.stringify(c.theme) : c.theme) : null;
                const classroomId = c.id || Date.now();
                const hasExplicitArchived = c.archived !== undefined && c.archived !== null;
                const archivedInt = hasExplicitArchived
                    ? (parseArchivedBool(c.archived) ? 1 : 0)
                    : (existing ? (parseArchivedBool(existing.archived) ? 1 : 0) : 0);
                const descriptionVal = c.description !== undefined ? String(c.description || '') : (existing?.description || '');
                const mergedSettings = c.settings !== undefined ? parseClassroomSettings(c.settings) : parseClassroomSettings(existing?.settings);
                const settingsStr = JSON.stringify(mergedSettings);

                let classCode = (c.code || '').toString().trim().toLowerCase();
                if (!classCode) {
                    const existingDbClassroom = await db.get('SELECT id, code FROM classrooms WHERE id = ?', classroomId);
                    if (existingDbClassroom?.code) classCode = existingDbClassroom.code.trim().toLowerCase();
                }

                let codeConflict = false;
                if (classCode) {
                    if (assignedInBatch.has(classCode)) {
                        codeConflict = true;
                    } else {
                        const row = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                        if (row) codeConflict = true;
                    }
                }

                if (!classCode || codeConflict) {
                    let attempts = 0;
                    do {
                        classCode = db.generateClassCodeSync
                            ? db.generateClassCodeSync(assignedInBatch)
                            : ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
                        const conflict = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', classCode, classroomId);
                        if (!conflict) break;
                        attempts++;
                    } while (attempts < 50);
                }

                assignedInBatch.add(classCode);

                await db.run(`
                    INSERT INTO classrooms (id, code, section, name, subject, instructor, instructor_email, description, settings, theme, archived) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        code = excluded.code,
                        section = excluded.section,
                        name = excluded.name,
                        subject = excluded.subject,
                        instructor = excluded.instructor,
                        instructor_email = excluded.instructor_email,
                        description = COALESCE(excluded.description, classrooms.description),
                        settings = COALESCE(excluded.settings, classrooms.settings),
                        theme = COALESCE(excluded.theme, classrooms.theme),
                        archived = excluded.archived
                `,
                    classroomId, classCode, c.section || '', c.name || '', c.subject || '', instName, instEmail, descriptionVal, settingsStr, themeStr, archivedInt
                );
                await db.clearSyncDeletion('classrooms', String(classroomId)).catch(() => { });

                savedClassrooms.push({
                    ...c,
                    id: classroomId,
                    code: classCode,
                    description: descriptionVal,
                    settings: mergedSettings,
                    archived: Boolean(archivedInt),
                    instructor: instName,
                    instructorEmail: instEmail
                });
            }
            try { db.triggerSync(); } catch (_) { }
            io.emit('classrooms_changed', { classrooms: savedClassrooms });
            res.status(200).json({ message: 'Classrooms saved', classrooms: savedClassrooms });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.patch('/classrooms/:id/archive', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!(await checkClassroomAccess(req, id))) return res.status(403).json({ message: 'Access denied' });

            const classroom = await db.get('SELECT * FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', id, String(id));
            if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

            const hasExplicit = req.body && (req.body.archived !== undefined && req.body.archived !== null);
            const isArchived = hasExplicit ? parseArchivedBool(req.body.archived) : !parseArchivedBool(classroom.archived);
            const archivedVal = isArchived ? 1 : 0;

            await db.run('UPDATE classrooms SET archived = ? WHERE id = ?', archivedVal, classroom.id);
            await db.run(
                'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
                req.user?.name || req.user?.email || 'Instructor',
                isArchived ? 'Classroom Archived' : 'Classroom Unarchived',
                'Normal',
                `Classroom "${classroom.name || classroom.id}" was ${isArchived ? 'archived' : 'unarchived'}.`
            ).catch(() => { });

            try { db.triggerSync(); } catch (_) { }

            const payload = {
                classroomId: classroom.id,
                id: classroom.id,
                code: classroom.code || classroom.section,
                name: classroom.name,
                archived: isArchived
            };
            io.emit('classroom_archived', payload);
            io.emit('classrooms_changed', { classroom: { ...classroom, archived: isArchived }, classroomId: classroom.id, archived: isArchived });

            res.status(200).json({
                message: isArchived ? 'Classroom archived successfully' : 'Classroom unarchived successfully',
                classroomId: classroom.id,
                archived: isArchived
            });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.patch('/classrooms/:id/settings', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!(await checkClassroomAccess(req, id))) return res.status(403).json({ message: 'Access denied' });

            const existing = await db.get('SELECT * FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', id, String(id));
            if (!existing) return res.status(404).json({ message: 'Classroom not found' });

            const { name, description, section, subject, code, settings } = req.body || {};
            const nextName = name !== undefined ? String(name).trim() : String(existing.name || '').trim();
            if (!nextName) return res.status(400).json({ message: 'Class name is required' });

            const nextDescription = description !== undefined ? String(description || '') : (existing.description || '');
            const nextSection = section !== undefined ? String(section || '') : (existing.section || '');
            const nextSubject = subject !== undefined ? String(subject || '') : (existing.subject || '');

            let nextCode = code !== undefined ? String(code).trim().toLowerCase() : String(existing.code || '').trim().toLowerCase();
            if (!nextCode) {
                nextCode = db.generateClassCodeSync
                    ? db.generateClassCodeSync()
                    : ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
            }

            const codeConflict = await db.get('SELECT id FROM classrooms WHERE LOWER(code) = ? AND id != ?', nextCode, existing.id);
            if (codeConflict) {
                return res.status(409).json({ message: 'That class code is already in use by another classroom. Please regenerate a new code.' });
            }

            const prevSettings = parseClassroomSettings(existing.settings);
            const mergedSettings = parseClassroomSettings({
                ...prevSettings,
                ...(settings && typeof settings === 'object' ? settings : {})
            });
            const settingsStr = JSON.stringify(mergedSettings);

            await db.run(
                `UPDATE classrooms SET name = ?, description = ?, section = ?, subject = ?, code = ?, settings = ? WHERE id = ?`,
                nextName, nextDescription, nextSection, nextSubject, nextCode, settingsStr, existing.id
            );

            await db.run(
                'INSERT INTO audit_logs ("user", type, severity, "desc") VALUES (?, ?, ?, ?)',
                req.user?.name || req.user?.email || 'Instructor',
                'Classroom Settings Updated',
                'Normal',
                `Updated settings for classroom "${nextName}" (${nextCode}).`
            ).catch(() => { });

            try { db.triggerSync(); } catch (_) { }

            let parsedTheme = null;
            if (existing.theme) {
                try { parsedTheme = typeof existing.theme === 'string' ? JSON.parse(existing.theme) : existing.theme; } catch { }
            }

            const updatedClassroom = {
                ...existing,
                id: existing.id,
                name: nextName,
                description: nextDescription,
                section: nextSection,
                subject: nextSubject,
                code: nextCode,
                settings: mergedSettings,
                archived: parseArchivedBool(existing.archived),
                theme: parsedTheme,
                instructorEmail: existing.instructor_email || ''
            };

            io.emit('classroom_settings_changed', { classroomId: existing.id, classroom: updatedClassroom });
            io.emit('classrooms_changed', { classroomId: existing.id, classroom: updatedClassroom });

            res.status(200).json({ message: 'Classroom settings updated successfully', classroom: updatedClassroom });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.patch('/classrooms/:id/theme', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!(await checkClassroomAccess(req, id))) return res.status(403).json({ message: 'Access denied' });

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
            if (!(await checkClassroomAccess(req, req.params.id))) return res.status(403).json({ message: 'Access denied' });

            if (req.user.role === 'Teacher') {
                let allowDelete = false;
                try {
                    const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                    if (row) {
                        const config = JSON.parse(row.value);
                        if (config?.roles?.allowDeleteCourses === true) allowDelete = true;
                    }
                } catch (_) { }
                if (!allowDelete) {
                    return res.status(403).json({ message: 'Only System Admins can delete courses according to system settings.' });
                }
            }

            const id = req.params.id;
            const cwRows = await db.all('SELECT id FROM classwork WHERE classroom_id = ?', id).catch(() => []);
            const annRows = await db.all('SELECT id FROM announcements WHERE classroom_id = ?', id).catch(() => []);
            const enrRows = await db.all('SELECT student_email FROM enrollments WHERE classroom_id = ?', id).catch(() => []);

            await db.run('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => { });
            await db.run('DELETE FROM grades WHERE assignment_id IN (SELECT id FROM classwork WHERE classroom_id = ?)', id).catch(() => { });
            await db.run('DELETE FROM classwork WHERE classroom_id = ?', id).catch(() => { });
            await db.run('DELETE FROM enrollments WHERE classroom_id = ?', id).catch(() => { });
            await db.run('DELETE FROM announcements WHERE classroom_id = ?', id).catch(() => { });
            await db.run('DELETE FROM classrooms WHERE id = ?', id);

            for (const cw of (cwRows || [])) await db.recordSyncDeletion('classwork', String(cw.id));
            for (const ann of (annRows || [])) await db.recordSyncDeletion('announcements', String(ann.id));
            for (const en of (enrRows || [])) {
                if (en?.student_email) await db.recordSyncDeletion('enrollments', `${id}_${String(en.student_email).trim().toLowerCase()}`);
            }
            await db.recordSyncDeletion('classrooms', String(id));

            try { db.triggerSync(); } catch (_) { }
            res.status(200).json({ message: 'Classroom deleted successfully' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/classroom-students/:classroomId', authenticateToken, async (req, res) => {
        try {
            if (!(await checkClassroomAccess(req, req.params.classroomId))) return res.status(403).json({ message: 'Access denied' });

            const { classroomId } = req.params;
            const classroom = await db.get('SELECT * FROM classrooms WHERE id = ?', classroomId);
            const { instName, instEmail, realTeacher } = await resolveClassroomInstructor(classroom);
            const instructor = realTeacher
                ? { id: realTeacher.id, name: instName, email: instEmail, avatar: realTeacher.avatar || null, role: realTeacher.role }
                : { id: null, name: classroom?.instructor || 'Instructor', email: classroom?.instructor_email || '', avatar: null };

            const enrolledRows = await db.all(`
                SELECT DISTINCT 
                    u.id as user_id,
                    u.role as user_role,
                    COALESCE(u.name, e.student_name) as name, 
                    COALESCE(u.email, e.student_email) as email,
                    u.avatar
                FROM enrollments e
                LEFT JOIN users u ON (LOWER(u.email) = LOWER(e.student_email) OR u.id = e.student_id)
                WHERE e.classroom_id = ?
            `, classroomId).catch(() => []);

            const subRows = await db.all(`
                SELECT DISTINCT 
                    u.id as user_id,
                    u.role as user_role,
                    COALESCE(u.name, s.student_name) as name, 
                    COALESCE(u.email, s.student_name) as email,
                    u.avatar
                FROM submissions s
                JOIN classwork c ON CAST(s.assignment_id AS TEXT) = CAST(c.id AS TEXT)
                LEFT JOIN users u ON (LOWER(u.name) = LOWER(s.student_name) OR LOWER(u.email) = LOWER(s.student_name))
                WHERE c.classroom_id = ?
            `, classroomId).catch(() => []);

            const studentsMap = {};
            const idToKey = {};
            const nameToKey = {};
            for (const s of [...enrolledRows, ...subRows]) {
                if (!s || !s.name || !s.name.trim()) continue;
                const roleLower = String(s.user_role || '').toLowerCase();
                if (roleLower === 'teacher' || roleLower === 'instructor' || roleLower === 'admin') {
                    continue;
                }
                const cleanName = s.name.trim();
                const nameKey = cleanName.toLowerCase();
                const rawEmail = (s.email || '').trim().toLowerCase();
                const hasRealEmail = rawEmail.includes('@');
                if (instructor && (
                    (instructor.name && nameKey === instructor.name.toLowerCase()) ||
                    (instructor.email && hasRealEmail && rawEmail === instructor.email.toLowerCase())
                )) {
                    continue;
                }
                const resolvedEmail = hasRealEmail ? rawEmail : `${nameKey.replace(/\s+/g, '.')}@student.verity.edu`;
                const existingKey = (s.user_id != null && idToKey[String(s.user_id)])
                    || (hasRealEmail && studentsMap[rawEmail] ? rawEmail : null)
                    || (!hasRealEmail ? nameToKey[nameKey] : null);
                const key = existingKey || (hasRealEmail ? rawEmail : nameKey);
                if (!studentsMap[key]) {
                    studentsMap[key] = {
                        id: s.user_id || null,
                        name: cleanName,
                        email: resolvedEmail,
                        avatar: s.avatar || null
                    };
                    if (s.user_id != null) idToKey[String(s.user_id)] = key;
                    if (!nameToKey[nameKey]) nameToKey[nameKey] = key;
                } else if (!studentsMap[key].avatar && s.avatar) {
                    studentsMap[key].avatar = s.avatar;
                }
            }

            const sortedStudents = Object.values(studentsMap).sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
            );
            res.status(200).json({ students: sortedStudents, instructor });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    });

    app.get('/users/check-student', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const email = String(req.query.email || '').trim().toLowerCase();
            if (!email) return res.status(400).json({ exists: false, message: 'Email is required.' });
            const user = await db.get('SELECT id, name, email, role, status FROM users WHERE LOWER(TRIM(email)) = ?', email);
            if (!user) {
                return res.status(200).json({ exists: false, message: 'Student account not found. Please make sure the student is registered first.' });
            }
            if (String(user.role || '').toLowerCase() !== 'student') {
                return res.status(200).json({ exists: false, message: 'This email does not belong to a Student account.' });
            }
            return res.status(200).json({ exists: true, student: { id: user.id, name: user.name, email: user.email, status: user.status } });
        } catch (e) {
            res.status(500).json({ exists: false, message: e.message });
        }
    });

    app.post('/classrooms/:classroomId/enroll', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const { classroomId } = req.params;
            if (req.user.role === 'Teacher') {
                if (!(await checkClassroomAccess(req, classroomId))) {
                    return res.status(403).json({ message: 'You do not have permission to enroll students in this classroom.' });
                }
                let allowManage = true;
                try {
                    const row = await db.get("SELECT value FROM system_settings WHERE key = 'global_config'");
                    if (row) {
                        const config = JSON.parse(row.value);
                        if (config?.roles?.allowManageStudents === false) allowManage = false;
                    }
                } catch (_) { }
                if (!allowManage) {
                    return res.status(403).json({ message: 'Only System Admins can manage students according to system settings.' });
                }
            }

            const now = new Date().toISOString();
            const isBulk = Array.isArray(req.body?.students);
            const incomingStudents = isBulk
                ? req.body.students
                : [{
                    name: req.body?.studentName || req.user.name,
                    email: req.body?.studentEmail || req.user.email,
                    id: req.body?.studentId || (req.body?.studentEmail ? null : req.user.id)
                }];

            if (!incomingStudents.length) {
                return res.status(400).json({ message: 'Please provide at least one student email.' });
            }

            const verifiedStudents = [];
            for (const st of incomingStudents) {
                const studentEmail = (st.email || st.studentEmail || '').trim().toLowerCase();
                if (!studentEmail) {
                    if (!isBulk) return res.status(400).json({ message: 'Please enter a valid student email address.' });
                    continue;
                }

                const existingUser = await db.get('SELECT id, name, email, role, status FROM users WHERE LOWER(TRIM(email)) = ?', studentEmail);
                if (!existingUser) {
                    return res.status(404).json({
                        message: `Student "${studentEmail}" does not exist. Please make sure the student has a registered account first.`
                    });
                }
                if (String(existingUser.role || '').toLowerCase() !== 'student') {
                    return res.status(400).json({
                        message: `"${studentEmail}" is not a Student account and cannot be enrolled as a student.`
                    });
                }
                if (!isBulk) {
                    const alreadyEnrolled = await db.get(
                        'SELECT id FROM enrollments WHERE classroom_id = ? AND LOWER(TRIM(student_email)) = ?',
                        classroomId, existingUser.email.trim().toLowerCase()
                    );
                    if (alreadyEnrolled) {
                        return res.status(409).json({
                            message: `${existingUser.name || existingUser.email} is already enrolled in this classroom.`
                        });
                    }
                }

                verifiedStudents.push({
                    id: existingUser.id,
                    name: existingUser.name || studentEmail.split('@')[0],
                    email: existingUser.email.trim().toLowerCase()
                });
            }

            if (verifiedStudents.length === 0) {
                return res.status(400).json({ message: 'No valid registered students were provided.' });
            }

            const enrolledList = [];
            for (const student of verifiedStudents) {
                await db.run(`
                    INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                        student_id = excluded.student_id,
                        student_name = excluded.student_name,
                        enrolled_at = excluded.enrolled_at
                `, classroomId, student.id, student.name, student.email, now);
                await db.clearSyncDeletion('enrollments', `${classroomId}_${student.email}`).catch(() => { });
                enrolledList.push(student);
            }

            db.triggerSync();
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
            let classroom = await db.get('SELECT * FROM classrooms WHERE LOWER(code) = ?', trimmed);
            if (!classroom) {
                classroom = await db.get(
                    'SELECT * FROM classrooms WHERE LOWER(section) = ? OR LOWER(name) = ? OR CAST(id as TEXT) = ?',
                    trimmed, trimmed, trimmed
                );
            }
            if (!classroom) return res.status(404).json({ message: 'No class found with that code' });

            const classSettings = parseClassroomSettings(classroom.settings);
            if (classSettings.inviteCodes === 'Turned off') {
                return res.status(403).json({
                    message: 'Invite codes are turned off for this classroom. Contact your instructor to enable invite codes.'
                });
            }

            const isAdminRequester = String(req.user?.role || '').toLowerCase() === 'admin';
            const studentName = (isAdminRequester && req.body?.studentName)
                ? req.body.studentName
                : (req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Student'));
            const studentEmail = ((isAdminRequester && req.body?.studentEmail) ? req.body.studentEmail : (req.user?.email || '')).trim().toLowerCase();
            const studentId = req.user?.id || null;
            const now = new Date().toISOString();

            await db.run(`
                INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                    student_name = excluded.student_name,
                    student_id = COALESCE(excluded.student_id, enrollments.student_id),
                    enrolled_at = excluded.enrolled_at
            `, classroom.id, studentId, studentName, studentEmail, now);

            await db.clearSyncDeletion('enrollments', `${classroom.id}_${studentEmail}`).catch(() => { });
            try { db.triggerSync(); } catch (_) { }

            let parsedTheme = null;
            if (classroom.theme) {
                try { parsedTheme = typeof classroom.theme === 'string' ? JSON.parse(classroom.theme) : classroom.theme; } catch { }
            }
            const { instName, instEmail, realTeacher } = await resolveClassroomInstructor(classroom);

            res.status(200).json({
                classroom: {
                    ...classroom,
                    archived: parseArchivedBool(classroom.archived),
                    description: classroom.description || '',
                    settings: classSettings,
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
}

module.exports = { registerClassroomRoutes };
