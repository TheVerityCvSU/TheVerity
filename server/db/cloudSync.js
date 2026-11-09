/**
 * The Verity - High-Speed In-Memory Differential Cloud Synchronization Engine
 * 
 * Synchronizes Local SQLite (ComLab offline router) with Cloud PostgreSQL (Supabase).
 * 
 * Performance:
 * - Uses in-memory differential comparison: compares Local vs Cloud state and only transmits changes.
 * - Entire sync takes ~150ms when idle instead of looping hundreds of SQL queries.
 * - Handles offline mode gracefully: if router has no internet, silently skips without errors.
 */

const { Pool } = require('pg');

let pgPool = null;
let sqliteDb = null;
let isSyncing = false;
let syncTimer = null;
let lastSyncTime = null;
let lastSyncStatus = 'idle';
let connectionString = null;
let socketIoInstance = null;

function setSocketIo(io) {
    socketIoInstance = io;
}

function getCleanConnectionString(rawUrl) {
    if (!rawUrl) return null;
    let url = rawUrl.trim();
    if (url.includes('[YOUR-PASSWORD]')) return null;
    const authMatch = url.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
    if (authMatch) {
        const [, prefix, rawPass, suffix] = authMatch;
        if (!rawPass.includes('%25') && (rawPass.includes('%') || rawPass.includes('?'))) {
            url = `${prefix}${encodeURIComponent(rawPass)}${suffix}`;
        }
    }
    return url;
}

function getPool() {
    if (pgPool) return pgPool;
    if (!connectionString) return null;

    try {
        pgPool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3500,
            statement_timeout: 4500,
            query_timeout: 4500
        });

        pgPool.on('error', () => {
            // Suppress background pool error notices when network drops
        });

        return pgPool;
    } catch (_) {
        return null;
    }
}

/**
 * Initializes the Cloud Sync Engine.
 */
function initCloudSync(sqliteDatabase, dbUrl) {
    sqliteDb = sqliteDatabase;
    connectionString = getCleanConnectionString(dbUrl);

    if (!connectionString) {
        console.log('[Cloud Sync] No valid PostgreSQL DATABASE_URL found. Running standalone SQLite.');
        return;
    }

    console.log('[Cloud Sync] Bidirectional In-Memory Cloud Sync Engine initialized.');

    // Initial sync probe on startup (delayed 2s to allow server to bind)
    setTimeout(() => {
        syncBidirectional().catch(() => {});
    }, 2000);

    // Continuous background sync every 15 seconds
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
        syncBidirectional().catch(() => {});
    }, 15000);
}

/**
 * Performs fast differential synchronization between SQLite and Supabase.
 */
async function syncBidirectional() {
    if (isSyncing || !sqliteDb) return { status: 'skipped' };
    const pool = getPool();
    if (!pool) return { status: 'no_pool' };

    isSyncing = true;
    let client = null;

    try {
        client = await pool.connect();

        // Ensure schema columns match (e.g. archived in classrooms)
        await client.query(`
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS archived INTEGER DEFAULT 0;
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS theme TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
        `).catch(() => {});

        let pushedCount = 0;
        let pulledCount = 0;

        // ----------------------------------------------------
        // 1. CLASSROOMS DIFFERENTIAL SYNC
        // ----------------------------------------------------
        try {
            const localClasses = sqliteDb.prepare('SELECT id, code, section, name, subject, instructor, archived, instructor_email, theme FROM classrooms').all();
            const cloudClassesRes = await client.query('SELECT id, code, section, name, subject, instructor, archived, instructor_email, theme FROM classrooms');
            const cloudClasses = cloudClassesRes.rows || [];

            const localMap = new Map(localClasses.map(c => [String(c.id), c]));
            const cloudMap = new Map(cloudClasses.map(c => [String(c.id), c]));

            const isPhantom = (c) => !c || (!c.name) || (/^Classroom \d+$/i.test(String(c.name).trim()) && (!c.section || !String(c.section).trim()));

            // PUSH to Cloud: classrooms in local missing or modified in cloud
            for (const [id, localC] of localMap) {
                const cloudC = cloudMap.get(id);
                const localIsPhantom = isPhantom(localC);
                const cloudIsPhantom = isPhantom(cloudC);

                const needsPush = !cloudC ||
                    (cloudIsPhantom && !localIsPhantom) ||
                    String(localC.name || '') !== String(cloudC.name || '') ||
                    String(localC.code || '') !== String(cloudC.code || '') ||
                    String(localC.section || '') !== String(cloudC.section || '') ||
                    String(localC.subject || '') !== String(cloudC.subject || '') ||
                    String(localC.instructor || '') !== String(cloudC.instructor || '') ||
                    String(localC.instructor_email || '') !== String(cloudC.instructor_email || '') ||
                    Number(localC.archived || 0) !== Number(cloudC.archived || 0) ||
                    String(localC.theme || '') !== String(cloudC.theme || '');

                if (needsPush) {
                    await client.query(`
                        INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, theme)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (id) DO UPDATE SET
                            code = CASE WHEN EXCLUDED.code != '' THEN EXCLUDED.code ELSE classrooms.code END,
                            section = CASE WHEN EXCLUDED.section != '' THEN EXCLUDED.section ELSE classrooms.section END,
                            name = CASE WHEN EXCLUDED.name NOT LIKE 'Classroom %' THEN EXCLUDED.name ELSE classrooms.name END,
                            subject = CASE WHEN EXCLUDED.subject != '' THEN EXCLUDED.subject ELSE classrooms.subject END,
                            instructor = CASE WHEN EXCLUDED.instructor != '' THEN EXCLUDED.instructor ELSE classrooms.instructor END,
                            archived = EXCLUDED.archived,
                            instructor_email = COALESCE(NULLIF(EXCLUDED.instructor_email, ''), classrooms.instructor_email),
                            theme = COALESCE(EXCLUDED.theme, classrooms.theme)
                    `, [localC.id, localC.code || '', localC.section || '', localC.name || '', localC.subject || '', localC.instructor || '', localC.archived || 0, localC.instructor_email || null, localC.theme || null]);
                    pushedCount++;
                    cloudMap.set(id, { ...localC });
                }
            }

            // PULL to Local: classrooms in cloud missing or modified in local
            const upsertClassroomStmt = sqliteDb.prepare(`
                INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, theme)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    code = CASE WHEN excluded.code != '' THEN excluded.code ELSE classrooms.code END,
                    section = CASE WHEN excluded.section != '' THEN excluded.section ELSE classrooms.section END,
                    name = CASE WHEN excluded.name NOT LIKE 'Classroom %' THEN excluded.name ELSE classrooms.name END,
                    subject = CASE WHEN excluded.subject != '' THEN excluded.subject ELSE classrooms.subject END,
                    instructor = CASE WHEN excluded.instructor != '' THEN excluded.instructor ELSE classrooms.instructor END,
                    archived = excluded.archived,
                    instructor_email = COALESCE(NULLIF(excluded.instructor_email, ''), classrooms.instructor_email),
                    theme = COALESCE(excluded.theme, classrooms.theme)
            `);

            for (const [id, cloudC] of cloudMap) {
                const localC = localMap.get(id);
                const cloudIsPhantom = isPhantom(cloudC);
                const localIsPhantom = isPhantom(localC);

                // Never overwrite a non-phantom local classroom with a phantom placeholder from cloud
                if (localC && !localIsPhantom && cloudIsPhantom) {
                    continue;
                }

                const needsPull = !localC ||
                    (localIsPhantom && !cloudIsPhantom) ||
                    String(cloudC.name || '') !== String(localC.name || '') ||
                    String(cloudC.code || '') !== String(localC.code || '') ||
                    String(cloudC.section || '') !== String(localC.section || '') ||
                    String(cloudC.subject || '') !== String(localC.subject || '') ||
                    String(cloudC.instructor || '') !== String(localC.instructor || '') ||
                    String(cloudC.instructor_email || '') !== String(localC.instructor_email || '') ||
                    Number(cloudC.archived || 0) !== Number(localC.archived || 0) ||
                    String(cloudC.theme || '') !== String(localC.theme || '');

                if (needsPull) {
                    upsertClassroomStmt.run(cloudC.id, cloudC.code || '', cloudC.section || '', cloudC.name || '', cloudC.subject || '', cloudC.instructor || '', cloudC.archived || 0, cloudC.instructor_email || null, cloudC.theme || null);
                    pulledCount++;
                }
            }
        } catch (cErr) {
            console.warn('[Cloud Sync] Classroom sync notice:', cErr.message);
        }

        // ----------------------------------------------------
        // 2. CLASSWORK / ASSIGNMENTS DIFFERENTIAL SYNC
        // ----------------------------------------------------
        try {
            const localCw = sqliteDb.prepare('SELECT id, classroom_id, title, description, dueDate, type, created_at FROM classwork').all();
            const cloudCwRes = await client.query('SELECT id, classroom_id, title, description, duedate, type, created_at FROM classwork');
            const cloudCw = cloudCwRes.rows || [];

            const localCwMap = new Map(localCw.map(cw => [String(cw.id), cw]));
            const cloudCwMap = new Map(cloudCw.map(cw => [String(cw.id), cw]));

            // Refresh localMap for classroom FK references
            const localClassesNow = sqliteDb.prepare('SELECT id, code, section, name, subject, instructor, archived, instructor_email, theme FROM classrooms').all();
            const localClassMap = new Map(localClassesNow.map(c => [String(c.id), c]));

            // PUSH to Cloud
            for (const [id, lCw] of localCwMap) {
                const cCw = cloudCwMap.get(id);
                const needsPush = !cCw ||
                    String(lCw.title || '') !== String(cCw.title || '') ||
                    String(lCw.description || '') !== String(cCw.description || '') ||
                    String(lCw.dueDate || '') !== String(cCw.duedate || '') ||
                    String(lCw.type || '') !== String(cCw.type || '');

                if (needsPush) {
                    // Ensure classroom exists in Supabase with real details if available
                    const realClass = localClassMap.get(String(lCw.classroom_id));
                    if (realClass) {
                        await client.query(`
                            INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, theme)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (id) DO UPDATE SET
                                code = CASE WHEN EXCLUDED.code != '' THEN EXCLUDED.code ELSE classrooms.code END,
                                section = CASE WHEN EXCLUDED.section != '' THEN EXCLUDED.section ELSE classrooms.section END,
                                name = CASE WHEN EXCLUDED.name NOT LIKE 'Classroom %' THEN EXCLUDED.name ELSE classrooms.name END,
                                subject = CASE WHEN EXCLUDED.subject != '' THEN EXCLUDED.subject ELSE classrooms.subject END,
                                instructor = CASE WHEN EXCLUDED.instructor != '' THEN EXCLUDED.instructor ELSE classrooms.instructor END,
                                instructor_email = COALESCE(NULLIF(EXCLUDED.instructor_email, ''), classrooms.instructor_email)
                        `, [realClass.id, realClass.code || '', realClass.section || '', realClass.name || '', realClass.subject || '', realClass.instructor || '', realClass.archived || 0, realClass.instructor_email || null, realClass.theme || null]);
                    } else {
                        await client.query('INSERT INTO classrooms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [lCw.classroom_id, 'Classroom ' + lCw.classroom_id]);
                    }

                    await client.query(`
                        INSERT INTO classwork (id, classroom_id, title, description, duedate, type, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (id) DO UPDATE SET
                            classroom_id = EXCLUDED.classroom_id,
                            title = EXCLUDED.title,
                            description = EXCLUDED.description,
                            duedate = EXCLUDED.duedate,
                            type = EXCLUDED.type
                    `, [lCw.id, lCw.classroom_id, lCw.title, lCw.description || '', lCw.dueDate || '', lCw.type || 'Assignment', lCw.created_at || null]);
                    pushedCount++;
                    cloudCwMap.set(id, { ...lCw, duedate: lCw.dueDate });
                }
            }

            // PULL to Local
            const upsertCwStmt = sqliteDb.prepare(`
                INSERT INTO classwork (id, classroom_id, title, description, dueDate, type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    classroom_id = excluded.classroom_id,
                    title = excluded.title,
                    description = excluded.description,
                    dueDate = excluded.dueDate,
                    type = excluded.type
            `);

            for (const [id, cCw] of cloudCwMap) {
                const lCw = localCwMap.get(id);
                const needsPull = !lCw ||
                    String(cCw.title || '') !== String(lCw.title || '') ||
                    String(cCw.description || '') !== String(lCw.description || '') ||
                    String(cCw.duedate || '') !== String(lCw.dueDate || '') ||
                    String(cCw.type || '') !== String(lCw.type || '');

                if (needsPull) {
                    try {
                        sqliteDb.prepare('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)').run(cCw.classroom_id, 'Classroom ' + cCw.classroom_id);
                    } catch (_) {}
                    upsertCwStmt.run(cCw.id, cCw.classroom_id, cCw.title || '', cCw.description || '', cCw.duedate || '', cCw.type || 'Assignment', cCw.created_at ? new Date(cCw.created_at).toISOString() : null);
                    pulledCount++;
                }
            }
        } catch (cwErr) {
            console.warn('[Cloud Sync] Classwork sync notice:', cwErr.message);
        }

        // ----------------------------------------------------
        // 3. USERS DIFFERENTIAL SYNC (by email)
        // ----------------------------------------------------
        try {
            const localUsers = sqliteDb.prepare('SELECT id, name, email, password, role, status, lastLogin, avatar FROM users ORDER BY id ASC').all();
            const cloudUsersRes = await client.query('SELECT id, name, email, password, role, status, lastlogin, avatar FROM users ORDER BY id ASC');
            const cloudUsers = cloudUsersRes.rows || [];

            const localUserMap = new Map(localUsers.map(u => [u.email.toLowerCase(), u]));
            const cloudUserMap = new Map(cloudUsers.map(u => [u.email.toLowerCase(), u]));

            // PUSH to Cloud: any user created offline in SQLite or updated more recently in SQLite
            for (const [email, lU] of localUserMap) {
                if (lU.role === 'Admin') continue;
                const cU = cloudUserMap.get(email);
                const localNewer = Boolean(lU.lastLogin && (!cU?.lastlogin || new Date(lU.lastLogin) > new Date(cU.lastlogin)));
                const needsPush = !cU ||
                    (lU.password && lU.password !== cU.password && localNewer) ||
                    (lU.status && lU.status !== cU.status && localNewer) ||
                    (lU.name && lU.name !== cU.name && localNewer);

                if (needsPush) {
                    await client.query(`
                        INSERT INTO users (name, email, password, role, status, lastlogin, avatar)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (email) DO UPDATE SET
                            name = EXCLUDED.name,
                            password = EXCLUDED.password,
                            role = EXCLUDED.role,
                            status = EXCLUDED.status,
                            lastlogin = COALESCE(EXCLUDED.lastlogin, users.lastlogin),
                            avatar = COALESCE(EXCLUDED.avatar, users.avatar)
                    `, [lU.name, lU.email, lU.password, lU.role, lU.status || 'Active', lU.lastLogin || null, lU.avatar || null]);
                    pushedCount++;
                }
            }

            // PULL to Local: any user created or updated online on Cloud (preserving canonical Cloud ID & name)
            const findIdConflict = sqliteDb.prepare('SELECT id, email FROM users WHERE id = ? AND LOWER(email) != LOWER(?)');
            const moveConflictId = sqliteDb.prepare('UPDATE users SET id = ? WHERE id = ?');
            const upsertUserWithIdStmt = sqliteDb.prepare(`
                INSERT INTO users (id, name, email, password, role, status, lastLogin, avatar)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    id = excluded.id,
                    name = excluded.name,
                    password = excluded.password,
                    role = excluded.role,
                    status = excluded.status,
                    lastLogin = COALESCE(excluded.lastLogin, users.lastLogin),
                    avatar = COALESCE(excluded.avatar, users.avatar)
            `);
            const upsertUserStmt = sqliteDb.prepare(`
                INSERT INTO users (name, email, password, role, status, lastLogin, avatar)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    name = excluded.name,
                    password = excluded.password,
                    role = excluded.role,
                    status = excluded.status,
                    lastLogin = COALESCE(excluded.lastLogin, users.lastLogin),
                    avatar = COALESCE(excluded.avatar, users.avatar)
            `);

            for (const [email, cU] of cloudUserMap) {
                const lU = localUserMap.get(email);
                const needsPull = !lU ||
                    Number(cU.id) !== Number(lU.id) ||
                    (cU.name && cU.name !== lU.name) ||
                    (cU.password && cU.password !== lU.password) ||
                    (cU.status && cU.status !== lU.status);

                if (needsPull) {
                    try {
                        const conflict = findIdConflict.get(cU.id, cU.email);
                        if (conflict) {
                            moveConflictId.run(Number(cU.id) + 900000000 + Math.floor(Math.random() * 100000), cU.id);
                        }
                        upsertUserWithIdStmt.run(cU.id, cU.name || '', cU.email, cU.password || '', cU.role || 'Student', cU.status || 'Active', cU.lastlogin || null, cU.avatar || null);
                    } catch (_) {
                        upsertUserStmt.run(cU.name || '', cU.email, cU.password || '', cU.role || 'Student', cU.status || 'Active', cU.lastlogin || null, cU.avatar || null);
                    }
                    pulledCount++;
                }
            }
        } catch (uErr) {
            console.warn('[Cloud Sync] Users sync notice:', uErr.message);
        }

        // ----------------------------------------------------
        // 4. ENROLLMENTS DIFFERENTIAL SYNC
        // ----------------------------------------------------
        try {
            const localEn = sqliteDb.prepare('SELECT classroom_id, student_id, student_name, student_email, enrolled_at FROM enrollments').all();
            const cloudEnRes = await client.query('SELECT classroom_id, student_id, student_name, student_email, enrolled_at FROM enrollments');
            const cloudEn = cloudEnRes.rows || [];

            const key = (cId, email) => `${cId}_${(email || '').toLowerCase()}`;
            const localEnMap = new Map(localEn.map(e => [key(e.classroom_id, e.student_email), e]));
            const cloudEnMap = new Map(cloudEn.map(e => [key(e.classroom_id, e.student_email), e]));

            // PUSH to Cloud
            for (const [k, lE] of localEnMap) {
                if (!cloudEnMap.has(k)) {
                    await client.query(`
                        INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (classroom_id, student_email) DO NOTHING
                    `, [lE.classroom_id, lE.student_id || null, lE.student_name || '', lE.student_email.trim().toLowerCase(), lE.enrolled_at || null]);
                    pushedCount++;
                }
            }

            // PULL to Local
            const upsertEnStmt = sqliteDb.prepare(`
                INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(classroom_id, student_email) DO NOTHING
            `);

            for (const [k, cE] of cloudEnMap) {
                if (!localEnMap.has(k)) {
                    upsertEnStmt.run(cE.classroom_id, cE.student_id || null, cE.student_name || '', cE.student_email.trim().toLowerCase(), cE.enrolled_at ? new Date(cE.enrolled_at).toISOString() : null);
                    pulledCount++;
                }
            }
        } catch (enErr) {
            console.warn('[Cloud Sync] Enrollment sync notice:', enErr.message);
        }

        // ----------------------------------------------------
        // 5. ANNOUNCEMENTS DIFFERENTIAL SYNC
        // ----------------------------------------------------
        try {
            const localAnn = sqliteDb.prepare('SELECT id, classroom_id, title, details, author, posted, created_at FROM announcements').all();
            const cloudAnnRes = await client.query('SELECT id, classroom_id, title, details, author, posted, created_at FROM announcements');
            const cloudAnn = cloudAnnRes.rows || [];

            const localAnnMap = new Map(localAnn.map(a => [String(a.id), a]));
            const cloudAnnMap = new Map(cloudAnn.map(a => [String(a.id), a]));

            for (const [id, lA] of localAnnMap) {
                if (!cloudAnnMap.has(id)) {
                    await client.query(`
                        INSERT INTO announcements (id, classroom_id, title, details, author, posted, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title,
                            details = EXCLUDED.details,
                            author = EXCLUDED.author,
                            posted = EXCLUDED.posted
                    `, [lA.id, lA.classroom_id, lA.title || '', lA.details || '', lA.author || '', lA.posted || null, lA.created_at || null]);
                    pushedCount++;
                }
            }

            const upsertAnnStmt = sqliteDb.prepare(`
                INSERT INTO announcements (id, classroom_id, title, details, author, posted, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    details = excluded.details,
                    author = excluded.author,
                    posted = excluded.posted
            `);

            for (const [id, cA] of cloudAnnMap) {
                if (!localAnnMap.has(id)) {
                    upsertAnnStmt.run(cA.id, cA.classroom_id, cA.title || '', cA.details || '', cA.author || '', cA.posted || null, cA.created_at || null);
                    pulledCount++;
                }
            }
        } catch (_) {}

        // ----------------------------------------------------
        // 6. SUBMISSIONS DIFFERENTIAL SYNC (by assignment_id + student_name)
        // ----------------------------------------------------
        try {
            const kimUser = sqliteDb.prepare("SELECT name FROM users WHERE LOWER(email) = 'kimfabie123@gmail.com'").get();
            const canonicalKimName = (kimUser?.name && kimUser.name.trim()) || 'MIKOOOOO';
            const normalizeSubStudentName = (rawName) => {
                const trimmed = (rawName || '').trim();
                const lower = trimmed.toLowerCase();
                if (lower === 'kimfabie123@gmail.com' || lower === 'kimfabie' || lower === 'kim fabie') {
                    return canonicalKimName;
                }
                return trimmed;
            };

            const localSubs = sqliteDb.prepare('SELECT assignment_id, student_name, history, submittedAt FROM submissions').all();
            const cloudSubsRes = await client.query('SELECT assignment_id, student_name, history, submittedat FROM submissions');
            const cloudSubs = cloudSubsRes.rows || [];

            const subKey = (aId, sName) => `${aId}_${normalizeSubStudentName(sName).toLowerCase()}`;
            const localSubMap = new Map();
            for (const s of localSubs) {
                const k = subKey(s.assignment_id, s.student_name);
                const normName = normalizeSubStudentName(s.student_name);
                const prev = localSubMap.get(k);
                if (!prev || (s.submittedAt && (!prev.submittedAt || new Date(s.submittedAt) >= new Date(prev.submittedAt)))) {
                    localSubMap.set(k, { ...s, student_name: normName });
                }
            }
            const cloudSubMap = new Map();
            for (const s of cloudSubs) {
                const k = subKey(s.assignment_id, s.student_name);
                const normName = normalizeSubStudentName(s.student_name);
                const prev = cloudSubMap.get(k);
                if (!prev || (s.submittedat && (!prev.submittedat || new Date(s.submittedat) >= new Date(prev.submittedat)))) {
                    cloudSubMap.set(k, { ...s, student_name: normName });
                }
            }

            // PUSH to Cloud: local submissions missing or newer than cloud
            for (const [k, lS] of localSubMap) {
                const cS = cloudSubMap.get(k);
                const needsPush = !cS ||
                    (lS.submittedAt && (!cS.submittedat || new Date(lS.submittedAt) > new Date(cS.submittedat)));

                if (needsPush) {
                    if (lS.student_name.toLowerCase() === canonicalKimName.toLowerCase()) {
                        await client.query(
                            "DELETE FROM submissions WHERE assignment_id = $1 AND LOWER(TRIM(student_name)) IN ($2, 'kim fabie', 'kimfabie', 'kimfabie123@gmail.com')",
                            [lS.assignment_id, lS.student_name.toLowerCase()]
                        );
                    } else {
                        await client.query('DELETE FROM submissions WHERE assignment_id = $1 AND LOWER(TRIM(student_name)) = LOWER(TRIM($2))', [lS.assignment_id, lS.student_name]);
                    }
                    await client.query(`
                        INSERT INTO submissions (assignment_id, student_name, history, submittedat)
                        VALUES ($1, $2, $3, $4)
                    `, [lS.assignment_id, lS.student_name, lS.history || '[]', lS.submittedAt || null]);
                    pushedCount++;
                }
            }

            // PULL to Local: cloud submissions missing or newer than local
            const delLocalSub = sqliteDb.prepare('DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))');
            const delLocalKimSub = sqliteDb.prepare("DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) IN (?, 'kim fabie', 'kimfabie', 'kimfabie123@gmail.com')");
            const insLocalSub = sqliteDb.prepare('INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)');

            for (const [k, cS] of cloudSubMap) {
                const lS = localSubMap.get(k);
                const needsPull = !lS ||
                    (cS.submittedat && (!lS.submittedAt || new Date(cS.submittedat) > new Date(lS.submittedAt)));

                if (needsPull) {
                    try {
                        const hasCw = sqliteDb.prepare('SELECT 1 FROM classwork WHERE id = ?').get(cS.assignment_id);
                        if (!hasCw) {
                            sqliteDb.prepare('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)').run(1, 'Default Classroom');
                            sqliteDb.prepare('INSERT OR IGNORE INTO classwork (id, classroom_id, title) VALUES (?, ?, ?)').run(cS.assignment_id, 1, 'Assignment ' + cS.assignment_id);
                        }
                        if (cS.student_name.toLowerCase() === canonicalKimName.toLowerCase()) {
                            delLocalKimSub.run(cS.assignment_id, cS.student_name.toLowerCase());
                        } else {
                            delLocalSub.run(cS.assignment_id, cS.student_name);
                        }
                        insLocalSub.run(cS.assignment_id, cS.student_name, cS.history || '[]', cS.submittedat ? new Date(cS.submittedat).toISOString() : null);
                        pulledCount++;
                    } catch (_) {}
                }
            }
        } catch (subErr) {
            console.warn('[Cloud Sync] Submissions sync notice:', subErr.message);
        }

        // ----------------------------------------------------
        // 7. GRADES DIFFERENTIAL SYNC (by assignment_id + student_id)
        // ----------------------------------------------------
        try {
            const localGrades = sqliteDb.prepare('SELECT assignment_id, student_id, grade, feedback, graded_at FROM grades').all();
            const cloudGradesRes = await client.query('SELECT assignment_id, student_id, grade, feedback, graded_at FROM grades');
            const cloudGrades = cloudGradesRes.rows || [];

            const gradeKey = (aId, sId) => `${aId}_${sId}`;
            const localGradeMap = new Map(localGrades.map(g => [gradeKey(g.assignment_id, g.student_id), g]));
            const cloudGradeMap = new Map(cloudGrades.map(g => [gradeKey(g.assignment_id, g.student_id), g]));

            // PUSH to Cloud: local grades missing or newer than cloud
            for (const [k, lG] of localGradeMap) {
                const cG = cloudGradeMap.get(k);
                const needsPush = !cG ||
                    String(lG.grade || '') !== String(cG.grade || '') ||
                    String(lG.feedback || '') !== String(cG.feedback || '');

                if (needsPush) {
                    await client.query(`
                        INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (assignment_id, student_id) DO UPDATE SET
                            grade = EXCLUDED.grade,
                            feedback = EXCLUDED.feedback,
                            graded_at = EXCLUDED.graded_at
                    `, [String(lG.assignment_id), String(lG.student_id), String(lG.grade || ''), lG.feedback || '', lG.graded_at || null]);
                    pushedCount++;
                }
            }

            // PULL to Local: cloud grades missing or modified
            const upsertGradeStmt = sqliteDb.prepare(`
                INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                    grade = excluded.grade,
                    feedback = excluded.feedback,
                    graded_at = excluded.graded_at
            `);

            for (const [k, cG] of cloudGradeMap) {
                const lG = localGradeMap.get(k);
                const needsPull = !lG ||
                    String(cG.grade || '') !== String(lG.grade || '') ||
                    String(cG.feedback || '') !== String(lG.feedback || '');

                if (needsPull) {
                    upsertGradeStmt.run(String(cG.assignment_id), String(cG.student_id), String(cG.grade || ''), cG.feedback || '', cG.graded_at ? new Date(cG.graded_at).toISOString() : null);
                    pulledCount++;
                }
            }
        } catch (gradeErr) {
            console.warn('[Cloud Sync] Grades sync notice:', gradeErr.message);
        }

        lastSyncTime = Date.now();
        lastSyncStatus = 'success';

        if (pushedCount > 0 || pulledCount > 0) {
            console.log(`[Cloud Sync] Sync complete! Pushed to Cloud: ${pushedCount} items | Pulled to Local: ${pulledCount} items`);
            if (socketIoInstance) {
                try {
                    socketIoInstance.emit('classrooms_updated');
                    socketIoInstance.emit('users_updated');
                    socketIoInstance.emit('admin_stats_update');
                    socketIoInstance.emit('verity_data_synced', { pushed: pushedCount, pulled: pulledCount });
                } catch (_) {}
            }
        }

        return {
            status: 'success',
            pushed: pushedCount,
            pulled: pulledCount,
            timestamp: lastSyncTime
        };

    } catch (err) {
        lastSyncStatus = 'offline';
        if (pgPool && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || (err.message && err.message.includes('closed')))) {
            try { pgPool.end().catch(() => {}); } catch (_) {}
            pgPool = null;
        }
        // Network errors (offline router) are expected and handled silently
        return { status: 'offline', error: err.message };
    } finally {
        if (client) {
            try { client.release(); } catch (_) {}
        }
        isSyncing = false;
    }
}

/**
 * Triggers an immediate debounced sync (useful after mutations).
 */
let debounceTimeout = null;
function triggerSync() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        syncBidirectional().catch(() => {});
    }, 300);
}

function getSyncStatus() {
    return {
        isSyncing,
        lastSyncTime,
        lastSyncStatus
    };
}

module.exports = {
    initCloudSync,
    syncBidirectional,
    triggerSync,
    getSyncStatus,
    setSocketIo
};
