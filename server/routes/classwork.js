/**
 * Registers classwork CRUD and classroom announcement routes.
 */
function registerClassworkRoutes(app, { db, io, authMiddleware, classroomHelpers }) {
    const { authenticateToken, requireRole } = authMiddleware;
    const { getClassworkFromDb, saveClassworkToDb, checkClassroomAccess, getStudentAccessibleClassroomIds } = classroomHelpers;

    app.get('/classwork', authenticateToken, async (req, res) => {
        try {
            const classwork = await getClassworkFromDb();
            const roleLower = String(req.user?.role || '').toLowerCase();
            if (roleLower === 'admin') {
                return res.status(200).json({ classwork });
            }
            const isStudentUser = roleLower === 'student';
            if (isStudentUser && typeof getStudentAccessibleClassroomIds === 'function') {
                const allowedClassroomIds = await getStudentAccessibleClassroomIds(req);
                const filtered = classwork.filter(
                    (cw) => !cw.archived && !cw.deleted && cw.classroom_id != null && allowedClassroomIds.has(String(cw.classroom_id))
                );
                return res.status(200).json({ classwork: filtered });
            }

            const accessCache = new Map();
            const filtered = [];
            for (const cw of classwork) {
                if (isStudentUser && (cw.archived || cw.deleted)) continue;
                if (cw.classroom_id == null) continue;
                const key = String(cw.classroom_id);
                let hasAccess = accessCache.get(key);
                if (hasAccess === undefined) {
                    hasAccess = await checkClassroomAccess(req, cw.classroom_id);
                    accessCache.set(key, hasAccess);
                }
                if (hasAccess) filtered.push(cw);
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
            const isStudentUser = String(req.user?.role || '').toLowerCase() === 'student';
            const rawClasswork = await getClassworkFromDb(req.params.classroomId);
            const classwork = isStudentUser ? rawClasswork.filter(cw => !cw.archived && !cw.deleted) : rawClasswork;
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
            await saveClassworkToDb(classroomId, classwork, { allowEmpty: true });
            const updatedClasswork = await getClassworkFromDb(classroomId);
            const clientSocketId = req.headers['x-socket-id'];
            const senderSocket = clientSocketId && io.sockets.sockets.get(clientSocketId);
            if (senderSocket) {
                senderSocket.broadcast.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
            } else {
                io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
            }
            res.status(200).json({ message: 'Classwork saved', classwork: updatedClasswork });
        } catch (e) {
            console.error('Error saving classwork via PUT:', e);
            res.status(500).json({ message: 'Failed to save classwork' });
        }
    });

    app.delete('/classwork/:classroomId/:id', authenticateToken, requireRole('Teacher', 'Admin'), async (req, res) => {
        try {
            const { classroomId, id } = req.params;
            if (!(await checkClassroomAccess(req, classroomId))) {
                return res.status(403).json({ message: 'Access denied' });
            }
            const isSoftDelete = req.query?.soft === '1' || req.query?.soft === 'true' || req.body?.soft === true;
            if (isSoftDelete) {
                const currentItem = await db.get('SELECT description FROM classwork WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', classroomId, id, String(id));
                if (currentItem) {
                    let meta = {};
                    try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                    meta.deleted = true;
                    meta.deletedAt = new Date().toISOString();
                    await db.run('UPDATE classwork SET description = ? WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', JSON.stringify(meta), classroomId, id, String(id));
                }
            } else {
                try {
                    await db.run('DELETE FROM classwork WHERE classroom_id = ? AND (id = ? OR CAST(id AS TEXT) = ?)', classroomId, id, String(id));
                    await db.recordSyncDeletion('classwork', String(id));
                } catch (_) {
                    const currentItem = await db.get('SELECT description FROM classwork WHERE id = ?', id);
                    let meta = {};
                    try { meta = JSON.parse(currentItem?.description || '{}'); } catch { meta = { details: currentItem?.description }; }
                    meta.archived = true;
                    meta.deleted = true;
                    await db.run('UPDATE classwork SET description = ? WHERE id = ?', JSON.stringify(meta), id);
                }
            }
            try { db.triggerSync(); } catch (_) { }
            const updatedClasswork = await getClassworkFromDb(classroomId);
            io.emit('classwork_changed', { classroomId, classwork: updatedClasswork });
            res.status(200).json({ message: isSoftDelete ? 'Classwork moved to deleted items' : 'Classwork deleted', classwork: updatedClasswork });
        } catch (err) {
            console.error('Error deleting classwork:', err);
            res.status(500).json({ message: 'Failed to delete classwork' });
        }
    });

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

            await db.clearSyncDeletion('announcements', String(announcementId)).catch(() => { });
            try { db.triggerSync(); } catch (_) { }

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
            await db.recordSyncDeletion('announcements', String(id));
            try { db.triggerSync(); } catch (_) { }
            io.emit('announcement_deleted', { classroomId: Number(classroomId), announcementId: Number(id) });
            res.status(200).json({ success: true, message: 'Announcement deleted' });
        } catch (e) {
            console.error('Error deleting announcement:', e);
            res.status(500).json({ message: 'Failed to delete announcement', error: e.message });
        }
    });
}

module.exports = { registerClassworkRoutes };
