const {
    sendStudentNotificationEmail,
    formatDueDateForEmail
} = require('../utils/emailService');

const DEFAULT_REMINDER_LEAD_HOURS = 24;
const MIN_REMINDER_LEAD_HOURS = 1;
const MAX_REMINDER_LEAD_HOURS = 168; // 7 days
const DEFAULT_MISSED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_CHECK_DELAY_MS = 20 * 1000; // 20 seconds after startup

const DEFAULT_NOTIFICATION_PREFERENCES = {
    newClasswork: true,
    newMaterial: true,
    upcomingDeadline: true,
    missedActivity: true,
    gradeNotifications: true,
    instructorAnnouncements: false,
    reminderLeadTime: '24 hours before',
    reminderLeadHours: DEFAULT_REMINDER_LEAD_HOURS
};

function isMaterialItem(item) {
    if (!item) return false;
    const t = String(item.activityType || item.type || '').trim().toLowerCase();
    return t === 'material' || t === 'resource' || t === 'lesson';
}

function isLegacyHardcoded(item) {
    const idNum = Number(item?.id);
    const title = String(item?.title || '');
    return (idNum === 1 || idNum === 2) && (title.startsWith('Activity 1:') || title.startsWith('Activity 2:'));
}

function isDeliverableEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
    if (clean.endsWith('@verity.local') || clean.endsWith('@student.verity.edu')) return false;
    return true;
}

/**
 * Parses an activity dueDate into its exact local deadline Date.
 * Mirrors frontend/src/utils/dateUtils.js parseDueDeadline().
 */
function parseDueDeadline(dueDate) {
    if (!dueDate) return null;
    if (typeof dueDate === 'string') {
        const trimmed = dueDate.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            return new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        const parsed = new Date(trimmed);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(dueDate);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parses a reminder lead time string or number (e.g. "24 hours before", "2 days", 48) into clamped hours.
 */
function parseReminderLeadHours(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(MAX_REMINDER_LEAD_HOURS, Math.max(MIN_REMINDER_LEAD_HOURS, Math.round(value)));
    }
    const str = String(value || '').trim().toLowerCase();
    if (!str) return DEFAULT_REMINDER_LEAD_HOURS;

    const match = str.match(/(\d+(?:\.\d+)?)/);
    if (!match) return DEFAULT_REMINDER_LEAD_HOURS;

    let num = Number(match[1]);
    if (!Number.isFinite(num) || num <= 0) return DEFAULT_REMINDER_LEAD_HOURS;

    if (str.includes('day')) {
        num = num * 24;
    } else if (str.includes('week')) {
        num = num * 24 * 7;
    } else if (str.includes('min')) {
        num = Math.max(1, Math.ceil(num / 60));
    }

    return Math.min(MAX_REMINDER_LEAD_HOURS, Math.max(MIN_REMINDER_LEAD_HOURS, Math.round(num)));
}

function normalizeNotificationPreferences(raw = {}) {
    let parsed = raw;
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch (_) { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object') parsed = {};

    const leadText = parsed.reminderLeadTime !== undefined
        ? String(parsed.reminderLeadTime || '').trim() || DEFAULT_NOTIFICATION_PREFERENCES.reminderLeadTime
        : DEFAULT_NOTIFICATION_PREFERENCES.reminderLeadTime;
    const leadHours = parsed.reminderLeadHours !== undefined
        ? parseReminderLeadHours(parsed.reminderLeadHours)
        : parseReminderLeadHours(leadText);

    return {
        newClasswork: parsed.newClasswork !== undefined ? Boolean(parsed.newClasswork) : DEFAULT_NOTIFICATION_PREFERENCES.newClasswork,
        newMaterial: parsed.newMaterial !== undefined ? Boolean(parsed.newMaterial) : DEFAULT_NOTIFICATION_PREFERENCES.newMaterial,
        upcomingDeadline: parsed.upcomingDeadline !== undefined ? Boolean(parsed.upcomingDeadline) : DEFAULT_NOTIFICATION_PREFERENCES.upcomingDeadline,
        missedActivity: parsed.missedActivity !== undefined ? Boolean(parsed.missedActivity) : DEFAULT_NOTIFICATION_PREFERENCES.missedActivity,
        gradeNotifications: parsed.gradeNotifications !== undefined ? Boolean(parsed.gradeNotifications) : DEFAULT_NOTIFICATION_PREFERENCES.gradeNotifications,
        instructorAnnouncements: parsed.instructorAnnouncements !== undefined ? Boolean(parsed.instructorAnnouncements) : DEFAULT_NOTIFICATION_PREFERENCES.instructorAnnouncements,
        reminderLeadTime: leadText,
        reminderLeadHours: leadHours
    };
}

function parseClassworkMeta(row) {
    let meta = {};
    if (row?.description) {
        try {
            meta = typeof row.description === 'string' ? JSON.parse(row.description) : row.description;
        } catch (_) {
            meta = { details: row.description };
        }
    }
    return {
        id: Number(row.id),
        classroom_id: Number(row.classroom_id),
        title: row.title || meta.title || 'Untitled',
        dueDate: row.dueDate || row.duedate || meta.dueDate || '',
        type: row.type || '',
        activityType: meta.activityType || row.type || 'Assignment',
        details: meta.details !== undefined ? meta.details : (row.details !== undefined ? row.details : (row.description || '')),
        attachments: Array.isArray(meta.attachments) ? meta.attachments : (Array.isArray(row.attachments) ? row.attachments : []),
        points: meta.points !== undefined ? meta.points : row.points,
        grading: meta.grading !== undefined ? meta.grading : (row.grading || 'On'),
        archived: Boolean(meta.archived || row.archived),
        deleted: Boolean(meta.deleted || row.deleted)
    };
}

function formatRemainingTimeLabel(diffMs) {
    const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
    if (totalMinutes < 60) {
        return `in ${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
    }
    const totalHours = Math.round(totalMinutes / 60);
    if (totalHours < 24) {
        return `in ${totalHours} hour${totalHours === 1 ? '' : 's'}`;
    }
    const days = Math.floor(totalHours / 24);
    const remHours = totalHours % 24;
    if (remHours === 0) {
        return `in ${days} day${days === 1 ? '' : 's'}`;
    }
    return `in ${days} day${days === 1 ? '' : 's'} and ${remHours} hour${remHours === 1 ? '' : 's'}`;
}

/**
 * Creates the student email notification service covering:
 * - New classwork/activity uploads
 * - New learning material uploads
 * - Upcoming activity deadlines
 * - Missed activity alerts
 */
function createStudentNotificationService({
    db,
    emailSender = sendStudentNotificationEmail,
    missedLookbackMs = DEFAULT_MISSED_LOOKBACK_MS,
    checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS
}) {
    const inFlightClaims = new Set();
    let initialTimer = null;
    let periodicTimer = null;
    let isCheckingDeadlines = false;

    async function getStudentNotificationPreferences(email) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
        try {
            const row = await db.get(
                'SELECT preferences FROM user_notification_preferences WHERE LOWER(user_email) = ?',
                cleanEmail
            );
            if (row && row.preferences) {
                return normalizeNotificationPreferences(row.preferences);
            }
        } catch (_) { }
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    async function saveStudentNotificationPreferences(email, rawPrefs) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) throw new Error('User email is required');
        const current = await getStudentNotificationPreferences(cleanEmail);
        const nextInput = { ...current, ...(rawPrefs || {}) };
        if (rawPrefs && rawPrefs.reminderLeadTime !== undefined && rawPrefs.reminderLeadHours === undefined) {
            delete nextInput.reminderLeadHours;
        }
        const merged = normalizeNotificationPreferences(nextInput);
        const nowIso = new Date().toISOString();
        await db.run(`
            INSERT INTO user_notification_preferences (user_email, preferences, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_email) DO UPDATE SET
                preferences = excluded.preferences,
                updated_at = excluded.updated_at
        `, cleanEmail, JSON.stringify(merged), nowIso);
        return merged;
    }

    async function getActiveClassroomStudents(classroomId) {
        const rows = await db.all(`
            SELECT
                u.id AS user_id,
                u.role AS user_role,
                u.status AS user_status,
                COALESCE(NULLIF(TRIM(u.name), ''), e.student_name) AS name,
                COALESCE(NULLIF(TRIM(u.email), ''), e.student_email) AS email,
                e.student_name AS enrolled_name
            FROM enrollments e
            LEFT JOIN users u ON (LOWER(TRIM(u.email)) = LOWER(TRIM(e.student_email)) OR u.id = e.student_id)
            WHERE (e.classroom_id = ? OR CAST(e.classroom_id AS TEXT) = CAST(? AS TEXT))
              AND e.deleted_at IS NULL
        `, classroomId, String(classroomId)).catch(() => []);

        const byEmail = new Map();
        for (const r of (rows || [])) {
            const roleLower = String(r.user_role || '').trim().toLowerCase();
            if (roleLower === 'teacher' || roleLower === 'instructor' || roleLower === 'admin') continue;
            const statusLower = String(r.user_status || 'Active').trim().toLowerCase();
            if (statusLower === 'suspended' || statusLower === 'disabled' || statusLower === 'pending') continue;

            const cleanEmail = String(r.email || '').trim().toLowerCase();
            if (!isDeliverableEmail(cleanEmail)) continue;

            if (!byEmail.has(cleanEmail)) {
                byEmail.set(cleanEmail, {
                    id: r.user_id || null,
                    name: String(r.name || cleanEmail.split('@')[0]).trim(),
                    email: cleanEmail,
                    enrolledName: String(r.enrolled_name || '').trim()
                });
            }
        }
        return Array.from(byEmail.values());
    }

    async function claimNotificationSlot({ notificationType, classroomId, assignmentId, studentEmail, dueDateSnapshot = '' }) {
        const cleanEmail = String(studentEmail || '').trim().toLowerCase();
        const aId = Number(assignmentId);
        const cId = Number(classroomId) || null;
        if (!notificationType || !cleanEmail || isNaN(aId)) return { claimed: false, claimKey: null };

        const claimKey = `${notificationType}:${aId}:${cleanEmail}`;
        if (inFlightClaims.has(claimKey)) return { claimed: false, claimKey: null };
        inFlightClaims.add(claimKey);

        try {
            const nowIso = new Date().toISOString();
            const insertRes = await db.run(`
                INSERT INTO email_notifications_log (notification_type, classroom_id, assignment_id, student_email, due_date_snapshot, status, sent_at)
                VALUES (?, ?, ?, ?, ?, 'pending', ?)
                ON CONFLICT(notification_type, assignment_id, student_email) DO NOTHING
            `, notificationType, cId, aId, cleanEmail, dueDateSnapshot || '', nowIso);

            if (insertRes && Number(insertRes.changes) > 0) {
                return { claimed: true, claimKey };
            }

            if ((notificationType === 'deadline_near' || notificationType === 'missed_activity') && dueDateSnapshot) {
                const existing = await db.get(
                    'SELECT due_date_snapshot, status FROM email_notifications_log WHERE notification_type = ? AND assignment_id = ? AND student_email = ?',
                    notificationType, aId, cleanEmail
                ).catch(() => null);

                if (existing && String(existing.due_date_snapshot || '') !== String(dueDateSnapshot)) {
                    await db.run(
                        'UPDATE email_notifications_log SET due_date_snapshot = ?, status = ?, sent_at = ? WHERE notification_type = ? AND assignment_id = ? AND student_email = ?',
                        dueDateSnapshot, 'pending', nowIso, notificationType, aId, cleanEmail
                    );
                    return { claimed: true, claimKey };
                }
            }

            inFlightClaims.delete(claimKey);
            return { claimed: false, claimKey: null };
        } catch (err) {
            inFlightClaims.delete(claimKey);
            console.warn('[StudentNotification] Claim error:', err.message);
            return { claimed: false, claimKey: null };
        }
    }

    async function finalizeNotificationSlot({ notificationType, assignmentId, studentEmail, claimKey, status }) {
        try {
            const cleanEmail = String(studentEmail || '').trim().toLowerCase();
            await db.run(
                'UPDATE email_notifications_log SET status = ?, sent_at = ? WHERE notification_type = ? AND assignment_id = ? AND student_email = ?',
                status, new Date().toISOString(), notificationType, Number(assignmentId), cleanEmail
            ).catch(() => { });
        } finally {
            if (claimKey) inFlightClaims.delete(claimKey);
        }
    }

    async function dispatchNotification({
        notificationType,
        classroomId,
        assignmentId,
        student,
        dueDateSnapshot = '',
        emailPayload
    }) {
        const { claimed, claimKey } = await claimNotificationSlot({
            notificationType,
            classroomId,
            assignmentId,
            studentEmail: student.email,
            dueDateSnapshot
        });
        if (!claimed) return 'duplicate';

        let finalStatus = 'failed';
        try {
            const result = await emailSender({
                email: student.email,
                studentName: student.name,
                ...emailPayload
            });
            if (result && result.success) {
                finalStatus = 'sent';
            } else if (result && result.simulated) {
                finalStatus = 'skipped';
            } else {
                finalStatus = 'failed';
            }
        } catch (err) {
            console.warn(`[StudentNotification] Failed sending ${notificationType} to ${student.email}:`, err.message);
            finalStatus = 'failed';
        }

        await finalizeNotificationSlot({
            notificationType,
            assignmentId,
            studentEmail: student.email,
            claimKey,
            status: finalStatus
        });
        return finalStatus;
    }

    /**
     * Sends email notifications to enrolled students when a teacher uploads new classwork or materials.
     */
    async function notifyNewClassworkItems(classroomId, newItems = []) {
        const summary = { sent: 0, skipped: 0, failed: 0, duplicate: 0 };
        if (classroomId == null || !Array.isArray(newItems) || newItems.length === 0) return summary;

        const activeItems = newItems.filter(item =>
            item && item.id != null && !item.archived && !item.deleted && !isLegacyHardcoded(item)
        );
        if (activeItems.length === 0) return summary;

        const classroom = await db.get(
            'SELECT id, name, section, instructor, instructor_email, archived, deleted_at FROM classrooms WHERE id = ? OR CAST(id AS TEXT) = ?',
            classroomId, String(classroomId)
        ).catch(() => null);

        if (!classroom || Number(classroom.archived) === 1 || classroom.deleted_at) {
            return summary;
        }

        const students = await getActiveClassroomStudents(classroom.id);
        if (students.length === 0) return summary;

        const classroomName = classroom.section ? `${classroom.name} (${classroom.section})` : (classroom.name || 'Classroom');
        const instructorName = classroom.instructor || 'Your Instructor';

        const prefsCache = new Map();
        for (const student of students) {
            prefsCache.set(student.email, await getStudentNotificationPreferences(student.email));
        }

        for (const item of activeItems) {
            const isMat = isMaterialItem(item);
            const notificationType = isMat ? 'new_material' : 'new_classwork';
            const itemType = isMat ? 'Material' : (item.activityType || item.type || 'Activity');
            const itemTitle = item.title || `Untitled ${itemType}`;
            const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
            const dueDateLabel = isMat ? '' : formatDueDateForEmail(item.dueDate);
            const pointsVal = (!isMat && item.grading !== 'Off' && item.points) ? item.points : null;

            for (const student of students) {
                const prefs = prefsCache.get(student.email) || DEFAULT_NOTIFICATION_PREFERENCES;
                if (isMat && !prefs.newMaterial) {
                    summary.skipped++;
                    continue;
                }
                if (!isMat && !prefs.newClasswork) {
                    summary.skipped++;
                    continue;
                }

                const emailPayload = isMat
                    ? {
                        subject: `[The Verity] New Material: ${itemTitle} (${classroom.name || 'Classroom'})`,
                        badgeText: 'New Material',
                        badgeColor: '#2563eb',
                        headline: `New learning material in ${classroom.name || 'your classroom'}`,
                        introText: `${instructorName} uploaded a new learning material for your class.`,
                        classroomName,
                        instructorName,
                        itemTitle,
                        itemType,
                        dueDateLabel: '',
                        points: null,
                        attachmentCount,
                        footerNote: "You're receiving this email because New Materials Email Alerts are enabled in your Verity Settings."
                    }
                    : {
                        subject: `[The Verity] New ${itemType}: ${itemTitle} (${classroom.name || 'Classroom'})`,
                        badgeText: `New ${itemType}`,
                        badgeColor: '#10b981',
                        headline: `New ${itemType.toLowerCase()} posted in ${classroom.name || 'your classroom'}`,
                        introText: `${instructorName} uploaded a new ${itemType.toLowerCase()} for your class.`,
                        classroomName,
                        instructorName,
                        itemTitle,
                        itemType,
                        dueDateLabel,
                        points: pointsVal,
                        attachmentCount,
                        footerNote: "You're receiving this email because New Classwork Email Alerts are enabled in your Verity Settings."
                    };

                const outcome = await dispatchNotification({
                    notificationType,
                    classroomId: classroom.id,
                    assignmentId: item.id,
                    student,
                    dueDateSnapshot: item.dueDate || '',
                    emailPayload
                });
                summary[outcome] = (summary[outcome] || 0) + 1;
            }
        }

        return summary;
    }

    /**
     * Scans active classrooms and classwork for upcoming deadlines and missed activities,
     * notifying enrolled students who have not yet submitted.
     */
    async function runDeadlineAndMissedChecks({ now = new Date() } = {}) {
        const summary = {
            deadlineNear: { sent: 0, skipped: 0, failed: 0, duplicate: 0 },
            missedActivity: { sent: 0, skipped: 0, failed: 0, duplicate: 0 }
        };
        if (isCheckingDeadlines) return summary;
        isCheckingDeadlines = true;

        try {
            const classrooms = await db.all(
                'SELECT id, name, section, instructor, archived, deleted_at FROM classrooms WHERE COALESCE(archived, 0) = 0 AND deleted_at IS NULL'
            ).catch(() => []);
            if (!classrooms || classrooms.length === 0) return summary;

            const classroomById = new Map(classrooms.map(c => [String(c.id), c]));

            const rawClasswork = await db.all(
                "SELECT * FROM classwork WHERE deleted_at IS NULL AND COALESCE(NULLIF(TRIM(duedate), ''), '') != ''"
            ).catch(() => []);
            if (!rawClasswork || rawClasswork.length === 0) return summary;

            const submissions = await db.all(
                'SELECT assignment_id, student_name FROM submissions WHERE deleted_at IS NULL'
            ).catch(() => []);
            const submissionsByAssignment = new Map();
            for (const s of (submissions || [])) {
                const aKey = String(s.assignment_id);
                const sName = String(s.student_name || '').trim().toLowerCase();
                if (!sName) continue;
                if (!submissionsByAssignment.has(aKey)) submissionsByAssignment.set(aKey, new Set());
                submissionsByAssignment.get(aKey).add(sName);
            }

            const studentsCache = new Map();
            const prefsCache = new Map();
            const nowMs = now.getTime();

            for (const row of rawClasswork) {
                const cw = parseClassworkMeta(row);
                if (cw.archived || cw.deleted || isLegacyHardcoded(cw) || isMaterialItem(cw)) continue;

                const classroom = classroomById.get(String(cw.classroom_id));
                if (!classroom) continue;

                const deadline = parseDueDeadline(cw.dueDate);
                if (!deadline) continue;

                const deadlineMs = deadline.getTime();
                const diffMs = deadlineMs - nowMs;
                const overdueMs = nowMs - deadlineMs;

                // Skip deadlines too far in the future (> max lead window) or older than missed lookback
                if (diffMs > MAX_REMINDER_LEAD_HOURS * 60 * 60 * 1000) continue;
                if (overdueMs > missedLookbackMs) continue;

                const cKey = String(classroom.id);
                if (!studentsCache.has(cKey)) {
                    studentsCache.set(cKey, await getActiveClassroomStudents(classroom.id));
                }
                const students = studentsCache.get(cKey);
                if (!students || students.length === 0) continue;

                const submittedSet = submissionsByAssignment.get(String(cw.id));
                const classroomName = classroom.section ? `${classroom.name} (${classroom.section})` : (classroom.name || 'Classroom');
                const instructorName = classroom.instructor || 'Your Instructor';
                const itemType = cw.activityType || cw.type || 'Activity';
                const dueDateLabel = formatDueDateForEmail(cw.dueDate);
                const pointsVal = (cw.grading !== 'Off' && cw.points) ? cw.points : null;

                for (const student of students) {
                    // Check if student already submitted under any identifier alias
                    if (submittedSet) {
                        const candidates = [
                            student.email,
                            student.name,
                            student.enrolledName,
                            student.id != null ? String(student.id) : '',
                            student.email.includes('@') ? student.email.split('@')[0] : ''
                        ]
                            .filter(Boolean)
                            .map(v => String(v).trim().toLowerCase());

                        if (candidates.some(c => submittedSet.has(c))) {
                            continue;
                        }
                    }

                    if (!prefsCache.has(student.email)) {
                        prefsCache.set(student.email, await getStudentNotificationPreferences(student.email));
                    }
                    const prefs = prefsCache.get(student.email) || DEFAULT_NOTIFICATION_PREFERENCES;

                    // 1. Upcoming deadline alert
                    const leadMs = prefs.reminderLeadHours * 60 * 60 * 1000;
                    if (diffMs > 0 && diffMs <= leadMs) {
                        if (!prefs.upcomingDeadline) {
                            summary.deadlineNear.skipped++;
                        } else {
                            const remainingLabel = formatRemainingTimeLabel(diffMs);
                            const outcome = await dispatchNotification({
                                notificationType: 'deadline_near',
                                classroomId: classroom.id,
                                assignmentId: cw.id,
                                student,
                                dueDateSnapshot: cw.dueDate,
                                emailPayload: {
                                    subject: `[The Verity] Deadline Reminder: ${cw.title} is due ${remainingLabel}`,
                                    badgeText: 'Deadline Near',
                                    badgeColor: '#f59e0b',
                                    headline: `Reminder: "${cw.title}" is due ${remainingLabel}`,
                                    introText: `Your ${itemType.toLowerCase()} in ${classroomName} has an upcoming deadline and has not been submitted yet.`,
                                    classroomName,
                                    instructorName,
                                    itemTitle: cw.title,
                                    itemType,
                                    dueDateLabel,
                                    points: pointsVal,
                                    footerNote: "You're receiving this reminder because Upcoming Deadline Alerts are enabled in your Verity Settings."
                                }
                            });
                            summary.deadlineNear[outcome] = (summary.deadlineNear[outcome] || 0) + 1;
                        }
                    }

                    // 2. Missed activity alert
                    if (overdueMs > 0 && overdueMs <= missedLookbackMs) {
                        if (!prefs.missedActivity) {
                            summary.missedActivity.skipped++;
                        } else {
                            const outcome = await dispatchNotification({
                                notificationType: 'missed_activity',
                                classroomId: classroom.id,
                                assignmentId: cw.id,
                                student,
                                dueDateSnapshot: cw.dueDate,
                                emailPayload: {
                                    subject: `[The Verity] Missed Activity: ${cw.title} (${classroom.name || 'Classroom'})`,
                                    badgeText: 'Missed Activity',
                                    badgeColor: '#ef4444',
                                    headline: `You missed the deadline for "${cw.title}"`,
                                    introText: `The due date for this ${itemType.toLowerCase()} in ${classroomName} has passed and we have no submission on record for you.`,
                                    classroomName,
                                    instructorName,
                                    itemTitle: cw.title,
                                    itemType,
                                    dueDateLabel,
                                    points: pointsVal,
                                    footerNote: "If late submissions are allowed or you need assistance, please contact your instructor. You can manage these alerts in your Verity Settings."
                                }
                            });
                            summary.missedActivity[outcome] = (summary.missedActivity[outcome] || 0) + 1;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[StudentNotification] Deadline/missed check error:', err.message);
        } finally {
            isCheckingDeadlines = false;
        }

        return summary;
    }

    function startScheduler() {
        stopScheduler();
        initialTimer = setTimeout(() => {
            runDeadlineAndMissedChecks().catch(() => { });
        }, INITIAL_CHECK_DELAY_MS);
        if (initialTimer.unref) initialTimer.unref();

        periodicTimer = setInterval(() => {
            runDeadlineAndMissedChecks().catch(() => { });
        }, checkIntervalMs);
        if (periodicTimer.unref) periodicTimer.unref();
    }

    function stopScheduler() {
        if (initialTimer) {
            clearTimeout(initialTimer);
            initialTimer = null;
        }
        if (periodicTimer) {
            clearInterval(periodicTimer);
            periodicTimer = null;
        }
    }

    return {
        getStudentNotificationPreferences,
        saveStudentNotificationPreferences,
        notifyNewClassworkItems,
        runDeadlineAndMissedChecks,
        startScheduler,
        stopScheduler
    };
}

module.exports = {
    createStudentNotificationService,
    DEFAULT_NOTIFICATION_PREFERENCES,
    parseDueDeadline,
    parseReminderLeadHours,
    normalizeNotificationPreferences,
    isMaterialItem,
    isDeliverableEmail
};
