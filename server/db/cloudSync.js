/**
 * The Verity - Differential Cloud Synchronization Engine
 *
 * Synchronizes Local SQLite with Cloud PostgreSQL (Supabase) using:
 * - Causal Last-Write-Wins (updated_at) across all synced tables
 * - Bi-directional deletion tombstones (sync_deletions + deleted_at)
 * - Transactional ID-collision cascading (enrollments.student_id)
 * - Partial-error aggregation (never masks failures as success)
 */

const { Pool } = require('pg');

let pgPool = null;
let sqliteDb = null;
let isSyncing = false;
let syncTimer = null;
let lastSyncTime = null;
let lastSyncStatus = 'idle';
let lastSyncErrors = [];
let connectionString = null;
let socketIoInstance = null;
let onClassworkPulledCallback = null;

function setSocketIo(io) {
    socketIoInstance = io;
}

function setOnClassworkPulled(cb) {
    onClassworkPulledCallback = typeof cb === 'function' ? cb : null;
}

function parseTsMs(val) {
    if (!val) return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    const ms = Date.parse(String(val));
    return Number.isFinite(ms) ? ms : 0;
}

function toIsoOrNow(val) {
    const ms = parseTsMs(val);
    return ms > 0 ? new Date(ms).toISOString() : new Date().toISOString();
}

function getCleanConnectionString(rawUrl) {
    if (!rawUrl) return null;
    let url = rawUrl.trim();
    if (url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) return null;

    const psqlMatch = url.match(/postgres(?:ql)?:\/\/[^\s'"]+/);
    if (psqlMatch) url = psqlMatch[0];

    url = url.replace(/:\[([^\]]+)\]@/, ':$1@');

    const authMatch = url.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
    if (authMatch) {
        const [, prefix, rawPass, suffix] = authMatch;
        if (!rawPass.includes('%25') && (rawPass.includes('%') || rawPass.includes('?'))) {
            url = `${prefix}${encodeURIComponent(rawPass)}${suffix}`;
        }
    }

    // Rewrite IPv6-only direct db.*.supabase.co addresses to IPv4 pooler host
    if (url.includes('db.') && url.includes('.supabase.co')) {
        const refMatch = url.match(/db\.([a-z0-9_-]+)\.supabase\.co/i);
        if (refMatch) {
            const projectRef = refMatch[1];
            url = url.replace(/db\.[a-z0-9_-]+\.supabase\.co(?::5432)?/i, 'aws-0-ap-northeast-2.pooler.supabase.com:5432');
            url = url.replace(/postgres(?:ql)?:\/\/([^:]+):/, (m, user) => {
                if (user === 'postgres') return m.replace('postgres:', `postgres.${projectRef}:`);
                return m;
            });
        }
    }

    return url;
}

function getPool() {
    if (pgPool) return pgPool;
    if (!connectionString) return null;

    try {
        const useStrictTls = process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true';
        const sslConfig = (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) && process.env.PG_SSL !== 'true'
            ? undefined
            : { rejectUnauthorized: useStrictTls };

        pgPool = new Pool({
            connectionString,
            ssl: sslConfig,
            max: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3500,
            statement_timeout: 4500,
            query_timeout: 4500
        });

        pgPool.on('error', () => { });
        return pgPool;
    } catch (_) {
        return null;
    }
}

function initCloudSync(sqliteDatabase, dbUrl) {
    sqliteDb = sqliteDatabase;
    connectionString = getCleanConnectionString(dbUrl);

    if (!connectionString) {
        console.log('[Cloud Sync] No valid PostgreSQL DATABASE_URL found. Running standalone SQLite.');
        return;
    }

    const isRenderCloud = Boolean(
        process.env.RENDER ||
        process.env.RENDER_SERVICE_ID ||
        process.env.IS_RENDER_SERVICE
    );
    if (isRenderCloud) {
        console.log('[Cloud Sync] Running on Render Cloud; skipping background 15s Supabase sync polling.');
        return;
    }

    console.log('[Cloud Sync] Bidirectional LWW Cloud Sync Engine initialized.');

    setTimeout(() => {
        syncBidirectional().catch(() => { });
    }, 2000);

    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
        syncBidirectional().catch(() => { });
    }, 15000);
}

function ensureSyncSchema(localDb) {
    for (const stmt of [
        `ALTER TABLE classrooms ADD COLUMN archived INTEGER DEFAULT 0;`,
        `ALTER TABLE classrooms ADD COLUMN instructor_email TEXT;`,
        `ALTER TABLE classrooms ADD COLUMN description TEXT;`,
        `ALTER TABLE classrooms ADD COLUMN settings TEXT;`,
        `ALTER TABLE classrooms ADD COLUMN theme TEXT;`,
        `ALTER TABLE users ADD COLUMN avatar TEXT;`
    ]) {
        try { localDb.exec(stmt); } catch (_) { }
    }
    for (const tbl of ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements']) {
        try { localDb.exec(`ALTER TABLE ${tbl} ADD COLUMN updated_at TEXT;`); } catch (_) { }
        try { localDb.exec(`ALTER TABLE ${tbl} ADD COLUMN deleted_at TEXT;`); } catch (_) { }
    }
    try {
        localDb.exec(`
            CREATE TABLE IF NOT EXISTS sync_deletions (
                table_name TEXT NOT NULL,
                record_key TEXT NOT NULL,
                deleted_at TEXT NOT NULL,
                PRIMARY KEY (table_name, record_key)
            );
        `);
    } catch (_) { }
}

async function deleteSyncedRowLocal(localDb, tableName, key) {
    switch (tableName) {
        case 'classrooms':
            localDb.prepare('DELETE FROM classrooms WHERE id = ?').run(key);
            break;
        case 'classwork':
            localDb.prepare('DELETE FROM classwork WHERE id = ?').run(key);
            break;
        case 'users':
            localDb.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?)').run(key);
            break;
        case 'announcements':
            localDb.prepare('DELETE FROM announcements WHERE id = ?').run(key);
            break;
        case 'enrollments': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const cId = key.slice(0, idx);
                const email = key.slice(idx + 1);
                localDb.prepare('DELETE FROM enrollments WHERE CAST(classroom_id AS TEXT) = ? AND LOWER(TRIM(student_email)) = LOWER(TRIM(?))').run(cId, email);
            }
            break;
        }
        case 'submissions': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const aId = key.slice(0, idx);
                const nameLower = key.slice(idx + 1);
                localDb.prepare('DELETE FROM submissions WHERE CAST(assignment_id AS TEXT) = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))').run(aId, nameLower);
            }
            break;
        }
        case 'grades': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const aId = key.slice(0, idx);
                const studentIdLower = key.slice(idx + 1);
                localDb.prepare('DELETE FROM grades WHERE CAST(assignment_id AS TEXT) = ? AND LOWER(TRIM(student_id)) = LOWER(TRIM(?))').run(aId, studentIdLower);
            }
            break;
        }
    }
}

async function deleteSyncedRowCloud(client, tableName, key) {
    switch (tableName) {
        case 'classrooms':
            await client.query('DELETE FROM classrooms WHERE id = $1', [key]);
            break;
        case 'classwork':
            await client.query('DELETE FROM classwork WHERE id = $1', [key]);
            break;
        case 'users':
            await client.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [key]);
            break;
        case 'announcements':
            await client.query('DELETE FROM announcements WHERE id = $1', [key]);
            break;
        case 'enrollments': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const cId = key.slice(0, idx);
                const email = key.slice(idx + 1);
                await client.query('DELETE FROM enrollments WHERE CAST(classroom_id AS TEXT) = $1 AND LOWER(TRIM(student_email)) = LOWER(TRIM($2))', [cId, email]);
            }
            break;
        }
        case 'submissions': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const aId = key.slice(0, idx);
                const nameLower = key.slice(idx + 1);
                await client.query('DELETE FROM submissions WHERE CAST(assignment_id AS TEXT) = $1 AND LOWER(TRIM(student_name)) = LOWER(TRIM($2))', [aId, nameLower]);
            }
            break;
        }
        case 'grades': {
            const idx = key.indexOf('_');
            if (idx > 0) {
                const aId = key.slice(0, idx);
                const studentIdLower = key.slice(idx + 1);
                await client.query('DELETE FROM grades WHERE CAST(assignment_id AS TEXT) = $1 AND LOWER(TRIM(student_id)) = LOWER(TRIM($2))', [aId, studentIdLower]);
            }
            break;
        }
    }
}

function getRowUpdatedTsLocal(localDb, tableName, key) {
    try {
        switch (tableName) {
            case 'classrooms': {
                const r = localDb.prepare('SELECT updated_at FROM classrooms WHERE CAST(id AS TEXT) = ?').get(String(key));
                return r ? parseTsMs(r.updated_at) : -1;
            }
            case 'classwork': {
                const r = localDb.prepare('SELECT COALESCE(updated_at, created_at) AS ts FROM classwork WHERE CAST(id AS TEXT) = ?').get(String(key));
                return r ? parseTsMs(r.ts) : -1;
            }
            case 'users': {
                const r = localDb.prepare('SELECT COALESCE(updated_at, lastLogin) AS ts FROM users WHERE LOWER(email) = LOWER(?)').get(String(key));
                return r ? parseTsMs(r.ts) : -1;
            }
            case 'announcements': {
                const r = localDb.prepare('SELECT COALESCE(updated_at, created_at) AS ts FROM announcements WHERE CAST(id AS TEXT) = ?').get(String(key));
                return r ? parseTsMs(r.ts) : -1;
            }
            case 'enrollments': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const r = localDb.prepare('SELECT COALESCE(updated_at, enrolled_at) AS ts FROM enrollments WHERE CAST(classroom_id AS TEXT) = ? AND LOWER(TRIM(student_email)) = LOWER(TRIM(?))').get(key.slice(0, idx), key.slice(idx + 1));
                return r ? parseTsMs(r.ts) : -1;
            }
            case 'submissions': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const r = localDb.prepare('SELECT COALESCE(updated_at, submittedAt) AS ts FROM submissions WHERE CAST(assignment_id AS TEXT) = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))').get(key.slice(0, idx), key.slice(idx + 1));
                return r ? parseTsMs(r.ts) : -1;
            }
            case 'grades': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const r = localDb.prepare('SELECT COALESCE(updated_at, graded_at) AS ts FROM grades WHERE CAST(assignment_id AS TEXT) = ? AND LOWER(TRIM(student_id)) = LOWER(TRIM(?))').get(key.slice(0, idx), key.slice(idx + 1));
                return r ? parseTsMs(r.ts) : -1;
            }
        }
    } catch (_) { }
    return -1;
}

async function getRowUpdatedTsCloud(client, tableName, key) {
    try {
        switch (tableName) {
            case 'classrooms': {
                const res = await client.query('SELECT updated_at FROM classrooms WHERE CAST(id AS TEXT) = $1', [String(key)]);
                return res.rows?.[0] ? parseTsMs(res.rows[0].updated_at) : -1;
            }
            case 'classwork': {
                const res = await client.query('SELECT COALESCE(updated_at, created_at) AS ts FROM classwork WHERE CAST(id AS TEXT) = $1', [String(key)]);
                return res.rows?.[0] ? parseTsMs(res.rows[0].ts) : -1;
            }
            case 'users': {
                const res = await client.query('SELECT updated_at, lastlogin FROM users WHERE LOWER(email) = LOWER($1)', [String(key)]);
                return res.rows?.[0] ? Math.max(parseTsMs(res.rows[0].updated_at), parseTsMs(res.rows[0].lastlogin)) : -1;
            }
            case 'announcements': {
                const res = await client.query('SELECT COALESCE(updated_at, created_at) AS ts FROM announcements WHERE CAST(id AS TEXT) = $1', [String(key)]);
                return res.rows?.[0] ? parseTsMs(res.rows[0].ts) : -1;
            }
            case 'enrollments': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const res = await client.query('SELECT COALESCE(updated_at, enrolled_at) AS ts FROM enrollments WHERE CAST(classroom_id AS TEXT) = $1 AND LOWER(TRIM(student_email)) = LOWER(TRIM($2))', [key.slice(0, idx), key.slice(idx + 1)]);
                return res.rows?.[0] ? parseTsMs(res.rows[0].ts) : -1;
            }
            case 'submissions': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const res = await client.query('SELECT updated_at, submittedat FROM submissions WHERE CAST(assignment_id AS TEXT) = $1 AND LOWER(TRIM(student_name)) = LOWER(TRIM($2))', [key.slice(0, idx), key.slice(idx + 1)]);
                return res.rows?.[0] ? Math.max(parseTsMs(res.rows[0].updated_at), parseTsMs(res.rows[0].submittedat)) : -1;
            }
            case 'grades': {
                const idx = key.indexOf('_');
                if (idx <= 0) return -1;
                const res = await client.query('SELECT COALESCE(updated_at, graded_at) AS ts FROM grades WHERE CAST(assignment_id AS TEXT) = $1 AND LOWER(TRIM(student_id)) = LOWER(TRIM($2))', [key.slice(0, idx), key.slice(idx + 1)]);
                return res.rows?.[0] ? parseTsMs(res.rows[0].ts) : -1;
            }
        }
    } catch (_) { }
    return -1;
}

/**
 * Performs fast differential synchronization between SQLite and PostgreSQL.
 * Accepts optional `{ sqliteDb, pgClient }` overrides for deterministic testing.
 */
async function syncBidirectional(overrides = {}) {
    const activeSqlite = overrides.sqliteDb || sqliteDb;
    const injectedClient = overrides.pgClient || null;

    if (!injectedClient && isSyncing) return { status: 'skipped' };
    if (!activeSqlite) return { status: 'skipped' };

    const pool = injectedClient ? null : getPool();
    if (!injectedClient && !pool) return { status: 'no_pool' };

    if (!injectedClient) isSyncing = true;
    let client = injectedClient;
    const syncErrors = [];

    try {
        if (!client) client = await pool.connect();

        await client.query(`
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS archived INTEGER DEFAULT 0;
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS settings TEXT;
            ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS theme TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
        `).catch(() => { });
        for (const tbl of ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements']) {
            await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`).catch(() => { });
            await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`).catch(() => { });
        }
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_deletions (
                table_name VARCHAR(64) NOT NULL,
                record_key VARCHAR(255) NOT NULL,
                deleted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (table_name, record_key)
            );
        `).catch(() => { });

        ensureSyncSchema(activeSqlite);

        let pushedCount = 0;
        let pulledCount = 0;

        // ----------------------------------------------------
        // 0. TOMBSTONES RECONCILIATION (Propagate deletions cleanly)
        // ----------------------------------------------------
        try {
            const localDelRows = activeSqlite.prepare('SELECT table_name, record_key, deleted_at FROM sync_deletions').all();
            const cloudDelRes = await client.query('SELECT table_name, record_key, deleted_at FROM sync_deletions');
            const cloudDelRows = cloudDelRes.rows || [];

            const tombKey = (t, k) => `${String(t).toLowerCase()}::${String(k)}`;
            const localDelMap = new Map(localDelRows.map(r => [tombKey(r.table_name, r.record_key), r]));
            const cloudDelMap = new Map(cloudDelRows.map(r => [tombKey(r.table_name, r.record_key), r]));

            const allTombKeys = new Set([...localDelMap.keys(), ...cloudDelMap.keys()]);
            const upsertLocalTomb = activeSqlite.prepare(`
                INSERT INTO sync_deletions (table_name, record_key, deleted_at)
                VALUES (?, ?, ?)
                ON CONFLICT(table_name, record_key) DO UPDATE SET deleted_at = excluded.deleted_at
            `);
            const delLocalTomb = activeSqlite.prepare('DELETE FROM sync_deletions WHERE table_name = ? AND record_key = ?');

            for (const tk of allTombKeys) {
                const lT = localDelMap.get(tk);
                const cT = cloudDelMap.get(tk);
                const tableName = String((lT || cT).table_name).toLowerCase();
                const recordKey = String((lT || cT).record_key);
                const tombTs = Math.max(parseTsMs(lT?.deleted_at), parseTsMs(cT?.deleted_at));
                const tombIso = toIsoOrNow(tombTs);

                const localRowTs = getRowUpdatedTsLocal(activeSqlite, tableName, recordKey);
                const cloudRowTs = await getRowUpdatedTsCloud(client, tableName, recordKey);

                // If a live row was created/updated AFTER the deletion tombstone, prune stale tombstones instead
                if (localRowTs > tombTs || cloudRowTs > tombTs) {
                    if (lT) delLocalTomb.run(tableName, recordKey);
                    if (cT) await client.query('DELETE FROM sync_deletions WHERE table_name = $1 AND record_key = $2', [tableName, recordKey]);
                    continue;
                }

                // Propagate deletion to local SQLite if row still exists and is not newer
                if (localRowTs >= 0 && localRowTs <= tombTs) {
                    await deleteSyncedRowLocal(activeSqlite, tableName, recordKey);
                    pulledCount++;
                }
                if (!lT || parseTsMs(lT.deleted_at) < tombTs) {
                    upsertLocalTomb.run(tableName, recordKey, tombIso);
                }

                // Propagate deletion to Cloud if row still exists and is not newer
                if (cloudRowTs >= 0 && cloudRowTs <= tombTs) {
                    await deleteSyncedRowCloud(client, tableName, recordKey);
                    pushedCount++;
                }
                if (!cT || parseTsMs(cT.deleted_at) < tombTs) {
                    await client.query(`
                        INSERT INTO sync_deletions (table_name, record_key, deleted_at)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (table_name, record_key) DO UPDATE SET deleted_at = EXCLUDED.deleted_at
                    `, [tableName, recordKey, tombIso]);
                }
            }
        } catch (delErr) {
            syncErrors.push(`tombstones: ${delErr.message}`);
            console.warn('[Cloud Sync] Tombstones sync notice:', delErr.message);
        }

        // ----------------------------------------------------
        // 1. CLASSROOMS LWW SYNC
        // ----------------------------------------------------
        try {
            const localClasses = activeSqlite.prepare('SELECT id, code, section, name, subject, instructor, archived, instructor_email, description, settings, theme, updated_at FROM classrooms').all();
            const cloudClassesRes = await client.query('SELECT id, code, section, name, subject, instructor, archived, instructor_email, description, settings, theme, updated_at FROM classrooms');
            const cloudClasses = cloudClassesRes.rows || [];

            const localMap = new Map(localClasses.map(c => [String(c.id), c]));
            const cloudMap = new Map(cloudClasses.map(c => [String(c.id), c]));

            const isPhantom = (c) => !c || (!c.name) || (/^Classroom \d+$/i.test(String(c.name).trim()) && (!c.section || !String(c.section).trim()));
            const differs = (a, b) =>
                String(a.name || '') !== String(b.name || '') ||
                String(a.code || '') !== String(b.code || '') ||
                String(a.section || '') !== String(b.section || '') ||
                String(a.subject || '') !== String(b.subject || '') ||
                String(a.instructor || '') !== String(b.instructor || '') ||
                String(a.instructor_email || '') !== String(b.instructor_email || '') ||
                String(a.description || '') !== String(b.description || '') ||
                String(a.settings || '') !== String(b.settings || '') ||
                Number(a.archived || 0) !== Number(b.archived || 0) ||
                String(a.theme || '') !== String(b.theme || '');

            for (const [id, localC] of localMap) {
                const cloudC = cloudMap.get(id);
                const localIsPhantom = isPhantom(localC);
                const cloudIsPhantom = isPhantom(cloudC);
                if (cloudC && !cloudIsPhantom && localIsPhantom) continue;

                const lTs = parseTsMs(localC.updated_at);
                const cTs = parseTsMs(cloudC?.updated_at);

                const needsPush = !cloudC ||
                    (cloudIsPhantom && !localIsPhantom) ||
                    (differs(localC, cloudC) && (lTs > cTs || (lTs === 0 && cTs === 0 && !localIsPhantom)));

                if (needsPush) {
                    const syncIso = toIsoOrNow(localC.updated_at);
                    await client.query(`
                        INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, description, settings, theme, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (id) DO UPDATE SET
                            code = CASE WHEN EXCLUDED.code != '' THEN EXCLUDED.code ELSE classrooms.code END,
                            section = CASE WHEN EXCLUDED.section != '' THEN EXCLUDED.section ELSE classrooms.section END,
                            name = CASE WHEN EXCLUDED.name NOT LIKE 'Classroom %' THEN EXCLUDED.name ELSE classrooms.name END,
                            subject = CASE WHEN EXCLUDED.subject != '' THEN EXCLUDED.subject ELSE classrooms.subject END,
                            instructor = CASE WHEN EXCLUDED.instructor != '' THEN EXCLUDED.instructor ELSE classrooms.instructor END,
                            archived = EXCLUDED.archived,
                            instructor_email = COALESCE(NULLIF(EXCLUDED.instructor_email, ''), classrooms.instructor_email),
                            description = COALESCE(EXCLUDED.description, classrooms.description),
                            settings = COALESCE(EXCLUDED.settings, classrooms.settings),
                            theme = COALESCE(EXCLUDED.theme, classrooms.theme),
                            updated_at = EXCLUDED.updated_at
                    `, [localC.id, localC.code || '', localC.section || '', localC.name || '', localC.subject || '', localC.instructor || '', localC.archived || 0, localC.instructor_email || null, localC.description ?? null, localC.settings || null, localC.theme || null, syncIso]);
                    pushedCount++;
                    cloudMap.set(id, { ...localC, updated_at: syncIso });
                }
            }

            const upsertClassroomStmt = activeSqlite.prepare(`
                INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, description, settings, theme, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    code = CASE WHEN excluded.code != '' THEN excluded.code ELSE classrooms.code END,
                    section = CASE WHEN excluded.section != '' THEN excluded.section ELSE classrooms.section END,
                    name = CASE WHEN excluded.name NOT LIKE 'Classroom %' THEN excluded.name ELSE classrooms.name END,
                    subject = CASE WHEN excluded.subject != '' THEN excluded.subject ELSE classrooms.subject END,
                    instructor = CASE WHEN excluded.instructor != '' THEN excluded.instructor ELSE classrooms.instructor END,
                    archived = excluded.archived,
                    instructor_email = COALESCE(NULLIF(excluded.instructor_email, ''), classrooms.instructor_email),
                    description = COALESCE(excluded.description, classrooms.description),
                    settings = COALESCE(excluded.settings, classrooms.settings),
                    theme = COALESCE(excluded.theme, classrooms.theme),
                    updated_at = excluded.updated_at
            `);

            for (const [id, cloudC] of cloudMap) {
                const localC = localMap.get(id);
                const cloudIsPhantom = isPhantom(cloudC);
                const localIsPhantom = isPhantom(localC);
                if (localC && !localIsPhantom && cloudIsPhantom) continue;

                const lTs = parseTsMs(localC?.updated_at);
                const cTs = parseTsMs(cloudC.updated_at);

                const needsPull = !localC ||
                    (localIsPhantom && !cloudIsPhantom) ||
                    (differs(cloudC, localC) && (cTs > lTs || (lTs === 0 && cTs > 0)));

                if (needsPull) {
                    const syncIso = toIsoOrNow(cloudC.updated_at);
                    upsertClassroomStmt.run(cloudC.id, cloudC.code || '', cloudC.section || '', cloudC.name || '', cloudC.subject || '', cloudC.instructor || '', cloudC.archived || 0, cloudC.instructor_email || null, cloudC.description ?? null, cloudC.settings || null, cloudC.theme || null, syncIso);
                    pulledCount++;
                }
            }
        } catch (cErr) {
            syncErrors.push(`classrooms: ${cErr.message}`);
            console.warn('[Cloud Sync] Classroom sync notice:', cErr.message);
        }

        // ----------------------------------------------------
        // 2. CLASSWORK / ASSIGNMENTS LWW SYNC
        // ----------------------------------------------------
        try {
            const localCw = activeSqlite.prepare('SELECT id, classroom_id, title, description, dueDate, type, created_at, updated_at FROM classwork').all();
            const cloudCwRes = await client.query('SELECT id, classroom_id, title, description, duedate, type, created_at, updated_at FROM classwork');
            const cloudCw = cloudCwRes.rows || [];

            const localCwMap = new Map(localCw.map(cw => [String(cw.id), cw]));
            const cloudCwMap = new Map(cloudCw.map(cw => [String(cw.id), cw]));

            const localClassesNow = activeSqlite.prepare('SELECT id, code, section, name, subject, instructor, archived, instructor_email, theme FROM classrooms').all();
            const localClassMap = new Map(localClassesNow.map(c => [String(c.id), c]));

            const cwDiffers = (lCw, cCw) =>
                String(lCw.title || '') !== String(cCw.title || '') ||
                String(lCw.description || '') !== String(cCw.description || '') ||
                String(lCw.dueDate || '') !== String(cCw.duedate || '') ||
                String(lCw.type || '') !== String(cCw.type || '');

            for (const [id, lCw] of localCwMap) {
                const cCw = cloudCwMap.get(id);
                const lTs = parseTsMs(lCw.updated_at || lCw.created_at);
                const cTs = parseTsMs(cCw?.updated_at || cCw?.created_at);
                const needsPush = !cCw || (cwDiffers(lCw, cCw) && (lTs > cTs || (lTs === 0 && cTs === 0)));

                if (needsPush) {
                    const realClass = localClassMap.get(String(lCw.classroom_id));
                    if (realClass) {
                        await client.query(`
                            INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, theme)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (id) DO NOTHING
                        `, [realClass.id, realClass.code || '', realClass.section || '', realClass.name || '', realClass.subject || '', realClass.instructor || '', realClass.archived || 0, realClass.instructor_email || null, realClass.theme || null]);
                    } else {
                        await client.query('INSERT INTO classrooms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [lCw.classroom_id, 'Classroom ' + lCw.classroom_id]);
                    }

                    const syncIso = toIsoOrNow(lCw.updated_at || lCw.created_at);
                    await client.query(`
                        INSERT INTO classwork (id, classroom_id, title, description, duedate, type, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (id) DO UPDATE SET
                            classroom_id = EXCLUDED.classroom_id,
                            title = EXCLUDED.title,
                            description = EXCLUDED.description,
                            duedate = EXCLUDED.duedate,
                            type = EXCLUDED.type,
                            updated_at = EXCLUDED.updated_at
                    `, [lCw.id, lCw.classroom_id, lCw.title, lCw.description || '', lCw.dueDate || '', lCw.type || 'Assignment', lCw.created_at || null, syncIso]);
                    pushedCount++;
                    cloudCwMap.set(id, { ...lCw, duedate: lCw.dueDate, updated_at: syncIso });
                }
            }

            const upsertCwStmt = activeSqlite.prepare(`
                INSERT INTO classwork (id, classroom_id, title, description, dueDate, type, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    classroom_id = excluded.classroom_id,
                    title = excluded.title,
                    description = excluded.description,
                    dueDate = excluded.dueDate,
                    type = excluded.type,
                    updated_at = excluded.updated_at
            `);

            const pulledCwRows = [];
            for (const [id, cCw] of cloudCwMap) {
                const lCw = localCwMap.get(id);
                const lTs = parseTsMs(lCw?.updated_at || lCw?.created_at);
                const cTs = parseTsMs(cCw.updated_at || cCw.created_at);
                const needsPull = !lCw || (cwDiffers(lCw, cCw) && (cTs > lTs || (lTs === 0 && cTs > 0)));

                if (needsPull) {
                    try {
                        activeSqlite.prepare('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)').run(cCw.classroom_id, 'Classroom ' + cCw.classroom_id);
                    } catch (_) { }
                    const syncIso = toIsoOrNow(cCw.updated_at || cCw.created_at);
                    upsertCwStmt.run(cCw.id, cCw.classroom_id, cCw.title || '', cCw.description || '', cCw.duedate || '', cCw.type || 'Assignment', cCw.created_at ? new Date(cCw.created_at).toISOString() : null, syncIso);
                    pulledCount++;
                    pulledCwRows.push(cCw);
                }
            }
            if (pulledCwRows.length > 0 && onClassworkPulledCallback) {
                try { onClassworkPulledCallback(pulledCwRows); } catch (_) { }
            }
        } catch (cwErr) {
            syncErrors.push(`classwork: ${cwErr.message}`);
            console.warn('[Cloud Sync] Classwork sync notice:', cwErr.message);
        }

        // ----------------------------------------------------
        // 3. USERS LWW SYNC (with ID cascade into enrollments)
        // ----------------------------------------------------
        try {
            const localUsers = activeSqlite.prepare('SELECT id, name, email, password, role, status, lastLogin, avatar, updated_at FROM users ORDER BY id ASC').all();
            const cloudUsersRes = await client.query('SELECT id, name, email, password, role, status, lastlogin, avatar, updated_at FROM users ORDER BY id ASC');
            const cloudUsers = cloudUsersRes.rows || [];

            const localUserMap = new Map(localUsers.map(u => [u.email.toLowerCase(), u]));
            const cloudUserMap = new Map(cloudUsers.map(u => [u.email.toLowerCase(), u]));

            const userDiffers = (a, b) =>
                (a.name || '') !== (b.name || '') ||
                (a.password || '') !== (b.password || '') ||
                (a.role || '') !== (b.role || '') ||
                (a.status || '') !== (b.status || '') ||
                String(a.avatar || '') !== String(b.avatar || '');

            for (const [email, lU] of localUserMap) {
                if (lU.role === 'Admin') continue;
                const cU = cloudUserMap.get(email);
                const lTs = Math.max(parseTsMs(lU.updated_at), parseTsMs(lU.lastLogin));
                const cTs = Math.max(parseTsMs(cU?.updated_at), parseTsMs(cU?.lastlogin));

                const needsPush = !cU || (userDiffers(lU, cU) && lTs > cTs);

                if (needsPush) {
                    const syncIso = toIsoOrNow(lTs || lU.updated_at || lU.lastLogin);
                    await client.query(`
                        INSERT INTO users (name, email, password, role, status, lastlogin, avatar, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (email) DO UPDATE SET
                            name = EXCLUDED.name,
                            password = EXCLUDED.password,
                            role = EXCLUDED.role,
                            status = EXCLUDED.status,
                            lastlogin = COALESCE(EXCLUDED.lastlogin, users.lastlogin),
                            avatar = COALESCE(EXCLUDED.avatar, users.avatar),
                            updated_at = EXCLUDED.updated_at
                    `, [lU.name, lU.email, lU.password, lU.role, lU.status || 'Active', lU.lastLogin || null, lU.avatar || null, syncIso]);
                    pushedCount++;
                    cloudUserMap.set(email, { ...(cU || {}), ...lU, lastlogin: lU.lastLogin, updated_at: syncIso });
                }
            }

            const findIdConflict = activeSqlite.prepare('SELECT id, email FROM users WHERE id = ? AND LOWER(email) != LOWER(?)');
            const moveConflictId = activeSqlite.prepare('UPDATE users SET id = ? WHERE id = ?');
            const cascadeEnrollmentId = activeSqlite.prepare('UPDATE enrollments SET student_id = ? WHERE student_id = ?');
            const upsertUserWithIdStmt = activeSqlite.prepare(`
                INSERT INTO users (id, name, email, password, role, status, lastLogin, avatar, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    id = excluded.id,
                    name = excluded.name,
                    password = excluded.password,
                    role = excluded.role,
                    status = excluded.status,
                    lastLogin = COALESCE(excluded.lastLogin, users.lastLogin),
                    avatar = COALESCE(excluded.avatar, users.avatar),
                    updated_at = excluded.updated_at
            `);
            const upsertUserStmt = activeSqlite.prepare(`
                INSERT INTO users (name, email, password, role, status, lastLogin, avatar, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    name = excluded.name,
                    password = excluded.password,
                    role = excluded.role,
                    status = excluded.status,
                    lastLogin = COALESCE(excluded.lastLogin, users.lastLogin),
                    avatar = COALESCE(excluded.avatar, users.avatar),
                    updated_at = excluded.updated_at
            `);

            for (const [email, cU] of cloudUserMap) {
                const lU = localUserMap.get(email);
                const lTs = Math.max(parseTsMs(lU?.updated_at), parseTsMs(lU?.lastLogin));
                const cTs = Math.max(parseTsMs(cU.updated_at), parseTsMs(cU.lastlogin));

                const needsPull = !lU ||
                    Number(cU.id) !== Number(lU.id) ||
                    (userDiffers(cU, lU) && (cTs > lTs || (lTs === 0 && cTs === 0)));

                if (needsPull) {
                    const syncIso = toIsoOrNow(cTs || cU.updated_at || cU.lastlogin);
                    try {
                        activeSqlite.exec('BEGIN');
                        const conflict = findIdConflict.get(cU.id, cU.email);
                        if (conflict) {
                            const shiftedId = Number(cU.id) + 900000000 + Math.floor(Math.random() * 100000);
                            moveConflictId.run(shiftedId, cU.id);
                            cascadeEnrollmentId.run(shiftedId, cU.id);
                        }
                        if (lU && lU.id != null && Number(lU.id) !== Number(cU.id)) {
                            cascadeEnrollmentId.run(cU.id, lU.id);
                        }
                        upsertUserWithIdStmt.run(cU.id, cU.name || '', cU.email, cU.password || '', cU.role || 'Student', cU.status || 'Active', cU.lastlogin || null, cU.avatar || null, syncIso);
                        activeSqlite.exec('COMMIT');
                    } catch (_) {
                        try { activeSqlite.exec('ROLLBACK'); } catch (__) { }
                        upsertUserStmt.run(cU.name || '', cU.email, cU.password || '', cU.role || 'Student', cU.status || 'Active', cU.lastlogin || null, cU.avatar || null, syncIso);
                    }
                    pulledCount++;
                }
            }
        } catch (uErr) {
            syncErrors.push(`users: ${uErr.message}`);
            console.warn('[Cloud Sync] Users sync notice:', uErr.message);
        }

        // ----------------------------------------------------
        // 4. ENROLLMENTS LWW SYNC
        // ----------------------------------------------------
        try {
            const localEn = activeSqlite.prepare('SELECT classroom_id, student_id, student_name, student_email, enrolled_at, updated_at FROM enrollments').all();
            const cloudEnRes = await client.query('SELECT classroom_id, student_id, student_name, student_email, enrolled_at, updated_at FROM enrollments');
            const cloudEn = cloudEnRes.rows || [];

            const key = (cId, email) => `${cId}_${(email || '').toLowerCase()}`;
            const localEnMap = new Map(localEn.map(e => [key(e.classroom_id, e.student_email), e]));
            const cloudEnMap = new Map(cloudEn.map(e => [key(e.classroom_id, e.student_email), e]));

            const enDiffers = (a, b) =>
                String(a.student_name || '') !== String(b.student_name || '') ||
                String(a.student_id || '') !== String(b.student_id || '');

            for (const [k, lE] of localEnMap) {
                const cE = cloudEnMap.get(k);
                const lTs = parseTsMs(lE.updated_at || lE.enrolled_at);
                const cTs = parseTsMs(cE?.updated_at || cE?.enrolled_at);
                if (!cE || (enDiffers(lE, cE) && lTs > cTs)) {
                    const syncIso = toIsoOrNow(lE.updated_at || lE.enrolled_at);
                    await client.query(`
                        INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (classroom_id, student_email) DO UPDATE SET
                            student_id = COALESCE(EXCLUDED.student_id, enrollments.student_id),
                            student_name = COALESCE(NULLIF(EXCLUDED.student_name, ''), enrollments.student_name),
                            updated_at = EXCLUDED.updated_at
                    `, [lE.classroom_id, lE.student_id || null, lE.student_name || '', lE.student_email.trim().toLowerCase(), lE.enrolled_at || null, syncIso]);
                    pushedCount++;
                    cloudEnMap.set(k, { ...lE, updated_at: syncIso });
                }
            }

            const upsertEnStmt = activeSqlite.prepare(`
                INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                    student_id = COALESCE(excluded.student_id, enrollments.student_id),
                    student_name = COALESCE(NULLIF(excluded.student_name, ''), enrollments.student_name),
                    updated_at = excluded.updated_at
            `);

            for (const [k, cE] of cloudEnMap) {
                const lE = localEnMap.get(k);
                const lTs = parseTsMs(lE?.updated_at || lE?.enrolled_at);
                const cTs = parseTsMs(cE.updated_at || cE.enrolled_at);
                if (!lE || (enDiffers(cE, lE) && cTs > lTs)) {
                    const syncIso = toIsoOrNow(cE.updated_at || cE.enrolled_at);
                    upsertEnStmt.run(cE.classroom_id, cE.student_id || null, cE.student_name || '', cE.student_email.trim().toLowerCase(), cE.enrolled_at ? new Date(cE.enrolled_at).toISOString() : null, syncIso);
                    pulledCount++;
                }
            }
        } catch (enErr) {
            syncErrors.push(`enrollments: ${enErr.message}`);
            console.warn('[Cloud Sync] Enrollment sync notice:', enErr.message);
        }

        // ----------------------------------------------------
        // 5. ANNOUNCEMENTS LWW SYNC
        // ----------------------------------------------------
        try {
            const localAnn = activeSqlite.prepare('SELECT id, classroom_id, title, details, author, posted, created_at, updated_at FROM announcements').all();
            const cloudAnnRes = await client.query('SELECT id, classroom_id, title, details, author, posted, created_at, updated_at FROM announcements');
            const cloudAnn = cloudAnnRes.rows || [];

            const localAnnMap = new Map(localAnn.map(a => [String(a.id), a]));
            const cloudAnnMap = new Map(cloudAnn.map(a => [String(a.id), a]));

            const annDiffers = (a, b) =>
                String(a.title || '') !== String(b.title || '') ||
                String(a.details || '') !== String(b.details || '') ||
                String(a.author || '') !== String(b.author || '') ||
                Number(a.posted || 0) !== Number(b.posted || 0);

            for (const [id, lA] of localAnnMap) {
                const cA = cloudAnnMap.get(id);
                const lTs = parseTsMs(lA.updated_at || lA.posted || lA.created_at);
                const cTs = parseTsMs(cA?.updated_at || cA?.posted || cA?.created_at);
                if (!cA || (annDiffers(lA, cA) && lTs > cTs)) {
                    const syncIso = toIsoOrNow(lA.updated_at || lA.posted || lA.created_at);
                    await client.query(`
                        INSERT INTO announcements (id, classroom_id, title, details, author, posted, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title,
                            details = EXCLUDED.details,
                            author = EXCLUDED.author,
                            posted = EXCLUDED.posted,
                            updated_at = EXCLUDED.updated_at
                    `, [lA.id, lA.classroom_id, lA.title || '', lA.details || '', lA.author || '', lA.posted || null, lA.created_at || null, syncIso]);
                    pushedCount++;
                    cloudAnnMap.set(id, { ...lA, updated_at: syncIso });
                }
            }

            const upsertAnnStmt = activeSqlite.prepare(`
                INSERT INTO announcements (id, classroom_id, title, details, author, posted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    details = excluded.details,
                    author = excluded.author,
                    posted = excluded.posted,
                    updated_at = excluded.updated_at
            `);

            for (const [id, cA] of cloudAnnMap) {
                const lA = localAnnMap.get(id);
                const lTs = parseTsMs(lA?.updated_at || lA?.posted || lA?.created_at);
                const cTs = parseTsMs(cA.updated_at || cA.posted || cA.created_at);
                if (!lA || (annDiffers(cA, lA) && cTs > lTs)) {
                    const syncIso = toIsoOrNow(cA.updated_at || cA.posted || cA.created_at);
                    upsertAnnStmt.run(cA.id, cA.classroom_id, cA.title || '', cA.details || '', cA.author || '', cA.posted || null, cA.created_at || null, syncIso);
                    pulledCount++;
                }
            }
        } catch (annErr) {
            syncErrors.push(`announcements: ${annErr.message}`);
            console.warn('[Cloud Sync] Announcements sync notice:', annErr.message);
        }

        // ----------------------------------------------------
        // 6. SUBMISSIONS LWW SYNC (by assignment_id + student_name)
        // ----------------------------------------------------
        try {
            const normalizeSubStudentName = (rawName) => String(rawName || '').trim();

            const localSubs = activeSqlite.prepare('SELECT assignment_id, student_name, history, submittedAt, updated_at FROM submissions').all();
            const cloudSubsRes = await client.query('SELECT assignment_id, student_name, history, submittedat, updated_at FROM submissions');
            const cloudSubs = cloudSubsRes.rows || [];

            const subKey = (aId, sName) => `${aId}_${normalizeSubStudentName(sName).toLowerCase()}`;
            const subTs = (s) => Math.max(parseTsMs(s?.updated_at), parseTsMs(s?.submittedAt || s?.submittedat));

            const localSubMap = new Map();
            for (const s of localSubs) {
                const k = subKey(s.assignment_id, s.student_name);
                const normName = normalizeSubStudentName(s.student_name);
                const prev = localSubMap.get(k);
                if (!prev || subTs(s) >= subTs(prev)) {
                    localSubMap.set(k, { ...s, student_name: normName });
                }
            }
            const cloudSubMap = new Map();
            for (const s of cloudSubs) {
                const k = subKey(s.assignment_id, s.student_name);
                const normName = normalizeSubStudentName(s.student_name);
                const prev = cloudSubMap.get(k);
                if (!prev || subTs(s) >= subTs(prev)) {
                    cloudSubMap.set(k, { ...s, student_name: normName });
                }
            }

            for (const [k, lS] of localSubMap) {
                const cS = cloudSubMap.get(k);
                const lTs = subTs(lS);
                const cTs = subTs(cS);
                const needsPush = !cS || lTs > cTs;

                if (needsPush) {
                    const syncIso = toIsoOrNow(lTs || lS.submittedAt);
                    await client.query('DELETE FROM submissions WHERE assignment_id = $1 AND LOWER(TRIM(student_name)) = LOWER(TRIM($2))', [lS.assignment_id, lS.student_name]);
                    await client.query(`
                        INSERT INTO submissions (assignment_id, student_name, history, submittedat, updated_at)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [lS.assignment_id, lS.student_name, lS.history || '[]', lS.submittedAt || null, syncIso]);
                    pushedCount++;
                    cloudSubMap.set(k, { ...lS, submittedat: lS.submittedAt, updated_at: syncIso });
                }
            }

            const delLocalSub = activeSqlite.prepare('DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))');
            const insLocalSub = activeSqlite.prepare('INSERT INTO submissions (assignment_id, student_name, history, submittedAt, updated_at) VALUES (?, ?, ?, ?, ?)');

            for (const [k, cS] of cloudSubMap) {
                const lS = localSubMap.get(k);
                const lTs = subTs(lS);
                const cTs = subTs(cS);
                const needsPull = !lS || cTs > lTs;

                if (needsPull) {
                    const syncIso = toIsoOrNow(cTs || cS.submittedat);
                    activeSqlite.exec('BEGIN');
                    try {
                        const hasCw = activeSqlite.prepare('SELECT 1 FROM classwork WHERE id = ?').get(cS.assignment_id);
                        if (!hasCw) {
                            activeSqlite.prepare('INSERT OR IGNORE INTO classrooms (id, name) VALUES (?, ?)').run(1, 'Default Classroom');
                            activeSqlite.prepare('INSERT OR IGNORE INTO classwork (id, classroom_id, title) VALUES (?, ?, ?)').run(cS.assignment_id, 1, 'Assignment ' + cS.assignment_id);
                        }
                        delLocalSub.run(cS.assignment_id, cS.student_name);
                        insLocalSub.run(cS.assignment_id, cS.student_name, cS.history || '[]', cS.submittedat ? new Date(cS.submittedat).toISOString() : null, syncIso);
                        activeSqlite.exec('COMMIT');
                        pulledCount++;
                    } catch (subTxErr) {
                        try { activeSqlite.exec('ROLLBACK'); } catch (_) { }
                        throw subTxErr;
                    }
                }
            }
        } catch (sErr) {
            syncErrors.push(`submissions: ${sErr.message}`);
            console.warn('[Cloud Sync] Submissions sync notice:', sErr.message);
        }

        // ----------------------------------------------------
        // 7. GRADES LWW SYNC (fixed ping-pong loop)
        // ----------------------------------------------------
        try {
            const localGrades = activeSqlite.prepare('SELECT assignment_id, student_id, grade, feedback, graded_at, updated_at FROM grades').all();
            const cloudGradesRes = await client.query('SELECT assignment_id, student_id, grade, feedback, graded_at, updated_at FROM grades');
            const cloudGrades = cloudGradesRes.rows || [];

            const gradeKey = (aId, sId) => `${aId}_${String(sId).trim().toLowerCase()}`;
            const localGradeMap = new Map(localGrades.map(g => [gradeKey(g.assignment_id, g.student_id), g]));
            const cloudGradeMap = new Map(cloudGrades.map(g => [gradeKey(g.assignment_id, g.student_id), g]));

            const gradeDiffers = (a, b) =>
                String(a.grade || '') !== String(b.grade || '') ||
                String(a.feedback || '') !== String(b.feedback || '');

            // PUSH to Cloud: local missing on cloud OR locally modified more recently than cloud
            for (const [k, lG] of localGradeMap) {
                const cG = cloudGradeMap.get(k);
                const lTs = Math.max(parseTsMs(lG.updated_at), parseTsMs(lG.graded_at));
                const cTs = Math.max(parseTsMs(cG?.updated_at), parseTsMs(cG?.graded_at));

                const needsPush = !cG || (gradeDiffers(lG, cG) && (lTs > cTs || (lTs === 0 && cTs === 0)));

                if (needsPush) {
                    const syncIso = toIsoOrNow(lTs || lG.updated_at || lG.graded_at);
                    await client.query(`
                        INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (assignment_id, student_id) DO UPDATE SET
                            grade = EXCLUDED.grade,
                            feedback = EXCLUDED.feedback,
                            graded_at = EXCLUDED.graded_at,
                            updated_at = EXCLUDED.updated_at
                    `, [String(lG.assignment_id), String(lG.student_id), String(lG.grade || ''), lG.feedback || '', lG.graded_at || syncIso, syncIso]);
                    pushedCount++;
                    // Critical fix: keep cloudGradeMap synchronized so Pull loop below does not overwrite local back
                    cloudGradeMap.set(k, {
                        ...lG,
                        graded_at: lG.graded_at || syncIso,
                        updated_at: syncIso
                    });
                }
            }

            // PULL to Local: cloud missing locally OR cloud modified strictly more recently than local
            const upsertGradeStmt = activeSqlite.prepare(`
                INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                    grade = excluded.grade,
                    feedback = excluded.feedback,
                    graded_at = excluded.graded_at,
                    updated_at = excluded.updated_at
            `);

            for (const [k, cG] of cloudGradeMap) {
                const lG = localGradeMap.get(k);
                const lTs = Math.max(parseTsMs(lG?.updated_at), parseTsMs(lG?.graded_at));
                const cTs = Math.max(parseTsMs(cG.updated_at), parseTsMs(cG.graded_at));

                const needsPull = !lG || (gradeDiffers(cG, lG) && (cTs > lTs || (lTs === 0 && cTs > 0)));

                if (needsPull) {
                    const syncIso = toIsoOrNow(cTs || cG.updated_at || cG.graded_at);
                    upsertGradeStmt.run(
                        String(cG.assignment_id),
                        String(cG.student_id),
                        String(cG.grade || ''),
                        cG.feedback || '',
                        cG.graded_at ? new Date(cG.graded_at).toISOString() : syncIso,
                        syncIso
                    );
                    pulledCount++;
                }
            }
        } catch (gradeErr) {
            syncErrors.push(`grades: ${gradeErr.message}`);
            console.warn('[Cloud Sync] Grades sync notice:', gradeErr.message);
        }

        // ----------------------------------------------------
        // 8. SYSTEM SETTINGS LWW SYNC
        // ----------------------------------------------------
        try {
            const localSettings = activeSqlite.prepare('SELECT key, value FROM system_settings').all();
            const cloudSettingsRes = await client.query('SELECT key, value FROM system_settings');
            const cloudSettings = cloudSettingsRes.rows || [];

            const localSetMap = new Map(localSettings.map(s => [s.key, s.value]));
            const cloudSetMap = new Map(cloudSettings.map(s => [s.key, s.value]));

            const extractTs = (val) => {
                if (!val) return 0;
                try {
                    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                    if (parsed && typeof parsed._updatedAt === 'number') return parsed._updatedAt;
                } catch (_) { }
                return 0;
            };

            const upsertLocalSetting = activeSqlite.prepare(`
                INSERT INTO system_settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `);

            let settingsChanged = false;
            const allKeys = new Set([...localSetMap.keys(), ...cloudSetMap.keys()]);
            for (const key of allKeys) {
                const lVal = localSetMap.get(key);
                const cVal = cloudSetMap.get(key);
                if (lVal === cVal) continue;

                const lTs = extractTs(lVal);
                const cTs = extractTs(cVal);

                if (lVal !== undefined && (cVal === undefined || lTs > cTs)) {
                    await client.query(`
                        INSERT INTO system_settings (key, value)
                        VALUES ($1, $2)
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    `, [key, lVal]);
                    pushedCount++;
                } else if (cVal !== undefined) {
                    upsertLocalSetting.run(key, cVal);
                    pulledCount++;
                    settingsChanged = true;
                }
            }

            if (settingsChanged && socketIoInstance) {
                try {
                    const rows = activeSqlite.prepare('SELECT key, value FROM system_settings').all();
                    const settingsObj = {};
                    rows.forEach(r => {
                        try { settingsObj[r.key] = JSON.parse(r.value); } catch (_) { settingsObj[r.key] = r.value; }
                    });
                    socketIoInstance.emit('system_settings_updated', { settings: settingsObj });
                } catch (_) { }
            }
        } catch (settingsErr) {
            syncErrors.push(`system_settings: ${settingsErr.message}`);
            console.warn('[Cloud Sync] System settings sync notice:', settingsErr.message);
        }

        lastSyncTime = Date.now();
        lastSyncErrors = syncErrors;
        lastSyncStatus = syncErrors.length > 0 ? 'partial' : 'success';

        if (pushedCount > 0 || pulledCount > 0) {
            console.log(`[Cloud Sync] Sync complete (${lastSyncStatus})! Pushed: ${pushedCount} | Pulled: ${pulledCount}`);
            if (socketIoInstance) {
                try {
                    socketIoInstance.emit('classrooms_updated');
                    socketIoInstance.emit('users_updated');
                    socketIoInstance.emit('admin_stats_update');
                    socketIoInstance.emit('verity_data_synced', { pushed: pushedCount, pulled: pulledCount });
                } catch (_) { }
            }
        }

        return {
            status: lastSyncStatus,
            pushed: pushedCount,
            pulled: pulledCount,
            errors: syncErrors,
            timestamp: lastSyncTime
        };

    } catch (err) {
        lastSyncStatus = 'offline';
        lastSyncErrors = [err.message];
        if (pgPool && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || (err.message && err.message.includes('closed')))) {
            try { pgPool.end().catch(() => { }); } catch (_) { }
            pgPool = null;
        }
        return { status: 'offline', error: err.message };
    } finally {
        if (!injectedClient && client) {
            try { client.release(); } catch (_) { }
        }
        if (!injectedClient) isSyncing = false;
    }
}

let debounceTimeout = null;
function triggerSync() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        syncBidirectional().catch(() => { });
    }, 300);
}

function getSyncStatus() {
    return {
        isSyncing,
        lastSyncTime,
        lastSyncStatus,
        lastSyncErrors
    };
}

module.exports = {
    initCloudSync,
    syncBidirectional,
    triggerSync,
    getSyncStatus,
    setSocketIo,
    setOnClassworkPulled,
    getCleanConnectionString,
    parseTsMs,
};
