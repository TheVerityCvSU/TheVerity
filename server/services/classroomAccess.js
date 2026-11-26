const DEFAULT_CLASSROOM_SETTINGS = {
    inviteCodes: 'Turned on',
    stream: 'Students can post and comment',
    classworkStream: 'Show condensed notifications',
    showDeleted: false
};

function parseClassroomSettings(val) {
    if (!val) return { ...DEFAULT_CLASSROOM_SETTINGS };
    try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CLASSROOM_SETTINGS };
        return {
            inviteCodes: parsed.inviteCodes === 'Turned off' ? 'Turned off' : 'Turned on',
            stream: parsed.stream || DEFAULT_CLASSROOM_SETTINGS.stream,
            classworkStream: parsed.classworkStream || DEFAULT_CLASSROOM_SETTINGS.classworkStream,
            showDeleted: Boolean(parsed.showDeleted)
        };
    } catch (_) {
        return { ...DEFAULT_CLASSROOM_SETTINGS };
    }
}

function parseArchivedBool(val) {
    return val === true || Number(val) === 1 || String(val || '').toLowerCase() === 'true';
}

/**
 * Provides classroom/classwork persistence, RBAC ownership verification,
 * canonical student identity resolution, and user email synchronization.
 */
function createClassroomHelpers({ db, io, onClassworkCreated } = {}) {
    const getClassworkFromDb = async (classroomId) => {
        const rows = (classroomId && classroomId !== 'all')
            ? await db.all('SELECT * FROM classwork WHERE classroom_id = ? ORDER BY id DESC', classroomId)
            : await db.all('SELECT * FROM classwork ORDER BY id DESC');
        return rows.map(row => {
            let meta = {};
            if (row.description) {
                try {
                    meta = JSON.parse(row.description);
                } catch (_) {
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
                deleted: typeof meta.deleted === 'boolean' ? meta.deleted : false,
                deletedAt: meta.deletedAt || null,
                posted: meta.posted || row.created_at,
                testCases: Array.isArray(meta.testCases) ? meta.testCases : [],
                starterCode: meta.starterCode || '',
                duration: meta.duration !== undefined ? meta.duration : 60,
                videoDuration: meta.videoDuration ?? null,
                autoSaveInterval: meta.autoSaveInterval || '30s',
                treatWarningsAsErrors: !!meta.treatWarningsAsErrors,
                disableBack: !!meta.disableBack
            };
        });
    };

    const saveClassworkToDb = async (classroomId, classwork, { allowEmpty = false } = {}) => {
        if (classroomId == null || !Array.isArray(classwork)) return;
        if (classwork.length === 0 && !allowEmpty) {
            console.warn(`[saveClassworkToDb] Ignored empty classwork array for classroom ${classroomId} to prevent accidental wipe.`);
            return;
        }

        const existingRows = await db.all('SELECT id FROM classwork WHERE classroom_id = ?', classroomId).catch(() => []);
        const existingIdSet = new Set((existingRows || []).map(r => String(r.id)));
        const newlyCreatedItems = [];

        const currentIds = classwork.map(cw => Number(cw.id)).filter(id => !isNaN(id));

        const toDelete = currentIds.length > 0
            ? await db.all(
                `SELECT id FROM classwork WHERE classroom_id = ? AND id NOT IN (${currentIds.map(() => '?').join(',')})`,
                classroomId, ...currentIds
            )
            : await db.all('SELECT id FROM classwork WHERE classroom_id = ?', classroomId);

        for (const item of toDelete) {
            try {
                await db.run('DELETE FROM classwork WHERE id = ?', item.id);
                await db.recordSyncDeletion('classwork', String(item.id));
            } catch (_) {
                const currentItem = await db.get('SELECT description FROM classwork WHERE id = ?', item.id);
                let meta = {};
                try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                meta.archived = true;
                await db.run('UPDATE classwork SET description = ? WHERE id = ?', JSON.stringify(meta), item.id);
            }
        }

        for (const cw of classwork) {
            const id = Number(cw.id) || Date.now();
            const descObj = {
                details: cw.details !== undefined ? cw.details : (cw.description || ''),
                attachments: Array.isArray(cw.attachments) ? cw.attachments : [],
                points: cw.points !== undefined ? cw.points : '100',
                grading: cw.grading !== undefined ? cw.grading : 'On',
                archived: !!cw.archived,
                deleted: !!cw.deleted,
                deletedAt: cw.deletedAt || null,
                posted: cw.posted || null,
                testCases: Array.isArray(cw.testCases) ? cw.testCases : [],
                activityType: cw.activityType || cw.type || 'Assignment',
                starterCode: cw.starterCode !== undefined ? cw.starterCode : '',
                duration: cw.duration !== undefined ? cw.duration : 60,
                videoDuration: cw.videoDuration ?? null,
                autoSaveInterval: cw.autoSaveInterval || '30s',
                treatWarningsAsErrors: !!cw.treatWarningsAsErrors,
                disableBack: !!cw.disableBack
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
            await db.clearSyncDeletion('classwork', String(id)).catch(() => { });

            if (!existingIdSet.has(String(id)) && !descObj.archived && !descObj.deleted) {
                newlyCreatedItems.push({
                    id,
                    classroom_id: Number(classroomId) || classroomId,
                    title: cw.title || '',
                    dueDate: cw.dueDate || '',
                    type: cw.type || cw.activityType || '',
                    activityType: descObj.activityType,
                    details: descObj.details,
                    attachments: descObj.attachments,
                    points: descObj.points,
                    grading: descObj.grading,
                    archived: descObj.archived,
                    deleted: descObj.deleted
                });
            }
        }
        try { db.triggerSync(); } catch (_) { }
        if (newlyCreatedItems.length > 0 && typeof onClassworkCreated === 'function') {
            Promise.resolve(onClassworkCreated(classroomId, newlyCreatedItems)).catch((err) => {
                console.warn('[saveClassworkToDb] Notification dispatch notice:', err.message);
            });
        }
    };

    async function checkClassroomAccess(req, classroomId) {
        const roleLower = String(req.user?.role || '').toLowerCase();
        if (roleLower === 'admin') return true;

        if (roleLower === 'teacher' || roleLower === 'instructor') {
            const c = await db.get('SELECT id, instructor_email, instructor, name FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?', classroomId, String(classroomId));
            if (!c) return false;
            const teacherEmail = (req.user.email || '').trim().toLowerCase();
            const teacherName = (req.user.name || '').trim().toLowerCase();
            const cEmail = (c.instructor_email || '').trim().toLowerCase();
            const cName = (c.instructor || '').trim().toLowerCase();

            const matchesEmail = Boolean(teacherEmail && cEmail && cEmail === teacherEmail);
            const matchesName = Boolean(!cEmail && teacherName && cName && cName === teacherName);

            if (matchesEmail || matchesName) {
                if (teacherEmail && cEmail !== teacherEmail) {
                    db.run('UPDATE classrooms SET instructor_email = ? WHERE id = ?', teacherEmail, c.id).catch(() => { });
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
                   AND ((student_email IS NOT NULL AND LOWER(TRIM(student_email)) = ?) 
                     OR (student_id IS NOT NULL AND (student_id = ? OR CAST(student_id AS TEXT) = CAST(? AS TEXT)))
                     OR (student_name IS NOT NULL AND (LOWER(TRIM(student_name)) = ? OR LOWER(TRIM(student_name)) = ?)))`,
                classroomId, String(classroomId), studentEmail, studentId, String(studentId), studentName, studentEmail
            );
            if (e) return true;

            const sub = await db.get(
                `SELECT 1 FROM submissions 
                 WHERE (classroom_id = ? OR CAST(classroom_id AS TEXT) = CAST(? AS TEXT))
                   AND (student_name = ? OR LOWER(TRIM(student_name)) = ? OR LOWER(TRIM(student_name)) = ? OR student_id = ?)`,
                classroomId, String(classroomId), req.user.name || '', studentName, studentEmail, String(studentId)
            ).catch(() => null);
            if (sub) {
                db.run(
                    `INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(classroom_id, student_email) DO NOTHING`,
                    classroomId, studentId, req.user.name || 'Student', studentEmail, new Date().toISOString()
                ).catch(() => { });
                return true;
            }
            return false;
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
        if (!cw) {
            if (roleLower === 'student') {
                const studentEmail = (req.user.email || '').trim().toLowerCase();
                const studentName = (req.user.name || '').trim().toLowerCase();
                const studentId = String(req.user.id || '');
                const hasSub = await db.get(
                    `SELECT 1 FROM submissions 
                     WHERE (assignment_id = ? OR CAST(assignment_id AS TEXT) = ?)
                       AND (student_name = ? OR LOWER(student_name) = ? OR LOWER(student_name) = ? OR student_name = ?)`,
                    assignmentId, String(assignmentId), req.user.name || '', studentName, studentEmail, studentId
                ).catch(() => null);
                if (hasSub) return true;
            }
            return false;
        }
        return checkClassroomAccess(req, cw.classroom_id);
    }

    async function resolveCanonicalStudent(userObj, fallbackName = '', fallbackId = null, fallbackEmail = '') {
        const rawEmail = (userObj?.email || fallbackEmail || '').trim().toLowerCase();
        const rawName = (userObj?.name || fallbackName || '').trim();
        const rawId = userObj?.id || fallbackId || null;

        let dbUser = null;
        if (rawEmail) {
            dbUser = await db.get('SELECT id, name, email, role FROM users WHERE LOWER(email) = ?', rawEmail).catch(() => null);
        }
        if (!dbUser && rawId != null) {
            const byId = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', rawId).catch(() => null);
            if (byId && (!rawEmail || (byId.email || '').trim().toLowerCase() === rawEmail)) {
                dbUser = byId;
            }
        }

        const canonicalEmail = (dbUser?.email || rawEmail || '').trim().toLowerCase();
        const canonicalName = (dbUser?.name && dbUser.name.trim()) || rawName || canonicalEmail || 'Student';
        const canonicalId = dbUser?.id ?? rawId ?? canonicalName;

        const aliasSet = new Set();
        const addAlias = (val) => {
            if (val != null && String(val).trim()) aliasSet.add(String(val).trim().toLowerCase());
        };
        addAlias(canonicalName);
        addAlias(rawName);
        addAlias(fallbackName);
        addAlias(canonicalEmail);
        if (canonicalEmail && canonicalEmail.includes('@')) {
            addAlias(canonicalEmail.split('@')[0]);
        }
        if (canonicalEmail) {
            try {
                const enrRows = await db.all('SELECT DISTINCT student_name FROM enrollments WHERE LOWER(student_email) = ?', canonicalEmail);
                for (const r of (enrRows || [])) addAlias(r.student_name);
            } catch (_) { }
        }

        return { canonicalName, canonicalId, canonicalEmail, aliases: Array.from(aliasSet) };
    }

    async function syncUserEmailAcrossData(userId, oldEmail, newEmail, name, role) {
        if (!userId || !newEmail) return;
        const cleanOldEmail = (oldEmail || '').trim().toLowerCase();
        const cleanNewEmail = newEmail.trim().toLowerCase();
        const cleanName = (name || '').trim();
        const roleLower = String(role || '').toLowerCase();
        const isTeacher = roleLower === 'teacher' || roleLower === 'instructor';

        if (cleanOldEmail && cleanNewEmail && cleanOldEmail !== cleanNewEmail) {
            try {
                await db.run('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)', cleanNewEmail, userId, cleanOldEmail).catch(() => { });
                await db.run('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', cleanOldEmail, userId).catch(() => { });
                await db.run('UPDATE user_notification_preferences SET user_email = ? WHERE LOWER(user_email) = LOWER(?)', cleanNewEmail, cleanOldEmail).catch(() => { });
                await db.run('UPDATE email_notifications_log SET student_email = ? WHERE LOWER(student_email) = LOWER(?)', cleanNewEmail, cleanOldEmail).catch(() => { });
                await db.recordSyncDeletion('users', cleanOldEmail).catch(() => { });
                await db.clearSyncDeletion('users', cleanNewEmail).catch(() => { });
            } catch (_) { }
            const localSqlite = db.getSqliteDb ? db.getSqliteDb() : null;
            if (localSqlite) {
                try {
                    localSqlite.prepare('UPDATE users SET email = ? WHERE id = ? OR LOWER(email) = LOWER(?)').run(cleanNewEmail, userId, cleanOldEmail);
                    localSqlite.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').run(cleanOldEmail, userId);
                } catch (_) { }
            }
        }

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
                    ).catch(() => { });
                    await db.run('DELETE FROM enrollments WHERE id = ?', en.id).catch(() => { });
                    const oldEnrEmail = (en.student_email || '').trim().toLowerCase();
                    if (oldEnrEmail && oldEnrEmail !== cleanNewEmail) {
                        await db.recordSyncDeletion('enrollments', `${en.classroom_id}_${oldEnrEmail}`).catch(() => { });
                    }
                } else {
                    await db.run(
                        'UPDATE enrollments SET student_email = ?, student_id = ?, student_name = COALESCE(NULLIF(student_name, \'\'), ?) WHERE id = ?',
                        cleanNewEmail, userId, cleanName, en.id
                    ).catch(() => { });
                    if (cleanOldEmail && cleanOldEmail !== cleanNewEmail) {
                        await db.recordSyncDeletion('enrollments', `${en.classroom_id}_${cleanOldEmail}`).catch(() => { });
                    }
                    await db.clearSyncDeletion('enrollments', `${en.classroom_id}_${cleanNewEmail}`).catch(() => { });
                }
            }
        } catch (e) {
            console.error('[syncUserEmailAcrossData] Error updating enrollments:', e);
        }

        if (isTeacher || cleanName) {
            try {
                await db.run(
                    `UPDATE classrooms SET 
                        instructor_email = ?, 
                        instructor = COALESCE(NULLIF(instructor, ''), ?) 
                     WHERE (instructor_email IS NOT NULL AND LOWER(instructor_email) = ?) 
                        OR (instructor IS NOT NULL AND TRIM(LOWER(instructor)) = TRIM(LOWER(?)))`,
                    cleanNewEmail, cleanName, cleanOldEmail, cleanName
                ).catch(() => { });
            } catch (e) {
                console.error('[syncUserEmailAcrossData] Error updating teacher classrooms:', e);
            }
        }

        try {
            io.emit('classrooms_updated');
            io.emit('classroom_students_changed', {});
        } catch (_) { }
    }

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
                ).catch(() => { });
            }
        } catch (e) {
            console.warn('[reconcileDatabaseClassrooms] Warning during startup sync:', e.message);
        }
    }

    return {
        DEFAULT_CLASSROOM_SETTINGS,
        parseClassroomSettings,
        parseArchivedBool,
        getClassworkFromDb,
        saveClassworkToDb,
        checkClassroomAccess,
        checkAssignmentAccess,
        resolveCanonicalStudent,
        syncUserEmailAcrossData,
        reconcileDatabaseClassrooms
    };
}

module.exports = {
    createClassroomHelpers,
    DEFAULT_CLASSROOM_SETTINGS,
    parseClassroomSettings,
    parseArchivedBool
};
