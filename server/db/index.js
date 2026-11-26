const path = require('path');
const fs = require('fs');
const { openSqliteDatabase } = require('./sqlite-adapter');
const { hashPassword, isHashedPassword } = require('../utils/passwordHash');

const envCandidates = [
    process.env.ENV_FILE_PATH,
    path.join(__dirname, '..', 'server', '.env'),
    path.join(__dirname, 'server', '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
    path.join(process.cwd(), 'server', '.env'),
    path.join(process.cwd(), '.env'),
].filter(Boolean);

if (process.env.VERITY_SKIP_DOTENV !== '1') {
    for (const p of envCandidates) {
        if (fs.existsSync(p)) {
            try {
                require('dotenv').config({ path: p });
            } catch (_) { }
        }
    }
}

let provider = 'sqlite';
let pgPool = null;
let sqliteDb = null;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL || '';

// Helper to convert '?' placeholders to PostgreSQL '$1, $2, ...' placeholders
function convertPlaceholders(sql) {
    let index = 1;
    // Replace ? with $1, $2, etc.
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    // Strip SQLite-specific COLLATE NOCASE which does not exist in standard PostgreSQL
    converted = converted.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
    // Replace reserved words as column identifiers in audit_logs
    converted = converted.replace(/\baudit_logs\s*\(\s*(?:timestamp,\s*)?user,/i, (m) => m.replace(/\buser\b/, '"user"'));
    converted = converted.replace(/,\s*severity,\s*desc\s*\)/i, ', severity, "desc")');
    converted = converted.replace(/\ba\.(user|desc)\b/g, 'a."$1"');
    converted = converted.replace(/\baudit_logs\.(user|desc)\b/g, 'audit_logs."$1"');
    return converted;
}

function normalizeParams(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
}

function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    // Normalize casing between Postgres (lowercased) and SQLite (camelCased)
    if (row.lastlogin !== undefined && row.lastLogin === undefined) row.lastLogin = row.lastlogin;
    if (row.duedate !== undefined && row.dueDate === undefined) row.dueDate = row.duedate;
    if (row.submittedat !== undefined && row.submittedAt === undefined) row.submittedAt = row.submittedat;
    if (row.c !== undefined && !isNaN(Number(row.c))) row.c = Number(row.c);
    if (row.id !== undefined && !isNaN(Number(row.id))) row.id = Number(row.id);
    if (row.classroom_id !== undefined && !isNaN(Number(row.classroom_id))) row.classroom_id = Number(row.classroom_id);
    if (row.assignment_id !== undefined && !isNaN(Number(row.assignment_id))) row.assignment_id = Number(row.assignment_id);
    return row;
}

function generateClassCodeSync(takenSet = new Set()) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    let attempts = 0;
    while (attempts < 1000) {
        code = '';
        for (let i = 0; i < 7; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!takenSet.has(code)) {
            takenSet.add(code);
            return code;
        }
        attempts++;
    }
    const fallback = ('v' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).slice(0, 7);
    takenSet.add(fallback);
    return fallback;
}

function seedFromDatabaseJson(adapter, dataDir) {
    try {
        const candidatePaths = [
            path.join(dataDir, 'database.json'),
            path.join(__dirname, '..', 'database.json'),
            path.join(__dirname, 'database.json'),
            path.join(process.cwd(), 'server', 'database.json'),
            path.join(process.cwd(), 'database.json'),
            process.resourcesPath ? path.join(process.resourcesPath, 'database.json') : null
        ].filter(Boolean);

        const jsonFile = candidatePaths.find(p => fs.existsSync(p));
        if (!jsonFile) return;

        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

        const userCount = adapter.prepare('SELECT count(*) as c FROM users').get()?.c || 0;
        if (userCount === 0 && Array.isArray(data.users) && data.users.length > 0) {
            const insertUser = adapter.prepare('INSERT OR IGNORE INTO users (id, name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insertUserNoId = adapter.prepare('INSERT OR IGNORE INTO users (name, email, password, role, lastLogin, status) VALUES (?, ?, ?, ?, ?, ?)');
            data.users.forEach(u => {
                const rawPass = String(u.password || '');
                const safePass = (rawPass === 'google_sso_user' || isHashedPassword(rawPass))
                    ? rawPass
                    : hashPassword(rawPass || 'TempChangeMe!2026');
                if (u.id) insertUser.run(u.id, u.name, u.email, safePass, u.role, u.lastLogin, u.status);
                else insertUserNoId.run(u.name, u.email, safePass, u.role, u.lastLogin, u.status);
            });
            console.log(`[Database] Seeded ${data.users.length} users into SQLite from database.json.`);
        }

        const classCount = adapter.prepare('SELECT count(*) as c FROM classrooms').get()?.c || 0;
        if (classCount === 0 && Array.isArray(data.classrooms) && data.classrooms.length > 0) {
            const insertClassroom = adapter.prepare('INSERT OR IGNORE INTO classrooms (id, code, section, name, subject, instructor, instructor_email, description, settings, theme, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            data.classrooms.forEach(c => {
                insertClassroom.run(
                    c.id,
                    c.code || '',
                    c.section || '',
                    c.name || '',
                    c.subject || '',
                    c.instructor || '',
                    c.instructor_email || '',
                    c.description || '',
                    c.settings ? (typeof c.settings === 'string' ? c.settings : JSON.stringify(c.settings)) : null,
                    c.theme || null,
                    c.archived || 0
                );
            });
            console.log(`[Database] Seeded ${data.classrooms.length} classrooms into SQLite from database.json.`);
        }

        const cwCount = adapter.prepare('SELECT count(*) as c FROM classwork').get()?.c || 0;
        if (cwCount === 0 && data.classwork && typeof data.classwork === 'object') {
            const insertClasswork = adapter.prepare('INSERT OR IGNORE INTO classwork (id, classroom_id, title, description, dueDate, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const [classroomId, cwArray] of Object.entries(data.classwork)) {
                if (Array.isArray(cwArray)) {
                    cwArray.forEach(cw => {
                        insertClasswork.run(
                            cw.id,
                            parseInt(classroomId, 10),
                            cw.title,
                            cw.description,
                            cw.dueDate,
                            cw.type || '',
                            cw.created_at || null
                        );
                    });
                }
            }
            console.log(`[Database] Seeded classwork into SQLite from database.json.`);
        }

        const enCount = adapter.prepare('SELECT count(*) as c FROM enrollments').get()?.c || 0;
        if (enCount === 0 && Array.isArray(data.enrollments) && data.enrollments.length > 0) {
            const insertEn = adapter.prepare('INSERT OR IGNORE INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at) VALUES (?, ?, ?, ?, ?)');
            data.enrollments.forEach(en => {
                if (en.classroom_id && en.student_email) {
                    insertEn.run(
                        en.classroom_id,
                        en.student_id || null,
                        en.student_name || '',
                        en.student_email.trim().toLowerCase(),
                        en.enrolled_at || null
                    );
                }
            });
            console.log(`[Database] Seeded ${data.enrollments.length} enrollments into SQLite from database.json.`);
        }
    } catch (e) {
        console.warn('[Database] Seeding notice:', e.message);
    }
}

function initSqlite() {
    if (sqliteDb) return sqliteDb;
    try {
        const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
        const DB_FILE = path.join(DATA_DIR, 'database.sqlite');
        sqliteDb = openSqliteDatabase(DB_FILE);

        // WAL mode uses POSIX shared memory (mmap) which segfaults (exit 139) in Docker overlayfs
        if (process.platform === 'win32') {
            try { sqliteDb.pragma('journal_mode = WAL'); } catch (e) { }
        } else {
            try { sqliteDb.pragma('journal_mode = DELETE'); } catch (e) { }
        }
        try { sqliteDb.pragma('synchronous = NORMAL'); } catch (e) { }
        try { sqliteDb.pragma('busy_timeout = 5000'); } catch (e) { }

        // Run basic SQLite schema directly on this instance
        sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            lastLogin TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS classrooms (
            id INTEGER PRIMARY KEY,
            code TEXT,
            section TEXT,
            name TEXT,
            subject TEXT,
            instructor TEXT,
            instructor_email TEXT,
            description TEXT,
            settings TEXT,
            theme TEXT,
            archived INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            classroom_id INTEGER,
            student_id INTEGER,
            student_name TEXT,
            student_email TEXT,
            enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(classroom_id, student_email)
        );

        CREATE TABLE IF NOT EXISTS classwork (
            id INTEGER PRIMARY KEY,
            classroom_id INTEGER,
            title TEXT,
            description TEXT,
            dueDate TEXT,
            type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER,
            student_name TEXT,
            history TEXT,
            submittedAt TEXT,
            FOREIGN KEY (assignment_id) REFERENCES classwork(id)
        );

        CREATE TABLE IF NOT EXISTS security_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_string TEXT UNIQUE,
            count INTEGER DEFAULT 0,
            alt_tab_copy_paste_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            "user" TEXT,
            type TEXT,
            severity TEXT DEFAULT 'Normal',
            "desc" TEXT
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS uploaded_files (
            filename TEXT PRIMARY KEY,
            mime_type TEXT DEFAULT 'application/octet-stream',
            size_bytes INTEGER DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS uploaded_file_chunks (
            filename TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            data BLOB NOT NULL,
            PRIMARY KEY (filename, chunk_index)
        );

        CREATE TABLE IF NOT EXISTS access_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE,
            student_name TEXT,
            classroom TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS question_bank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            starter_code TEXT,
            test_cases TEXT,
            points INTEGER DEFAULT 100,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id TEXT,
            student_id TEXT,
            grade TEXT,
            feedback TEXT,
            graded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(assignment_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS otp_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            user_data TEXT,
            expires_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS proctor_session_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            classroom_id TEXT,
            assignment_id TEXT,
            student_id TEXT,
            student_name TEXT,
            action TEXT,
            message TEXT,
            time TEXT,
            color TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS announcements (
            id BIGINT PRIMARY KEY,
            classroom_id BIGINT,
            title TEXT,
            details TEXT,
            author TEXT,
            posted BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_announcements_classroom ON announcements(classroom_id);

        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'Admin',
            lastLogin TEXT,
            status TEXT DEFAULT 'Active',
            avatar TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_deletions (
            table_name TEXT NOT NULL,
            record_key TEXT NOT NULL,
            deleted_at TEXT NOT NULL,
            PRIMARY KEY (table_name, record_key)
        );

        CREATE TABLE IF NOT EXISTS email_notifications_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_type TEXT NOT NULL,
            classroom_id INTEGER,
            assignment_id INTEGER,
            student_email TEXT NOT NULL,
            due_date_snapshot TEXT,
            status TEXT DEFAULT 'sent',
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(notification_type, assignment_id, student_email)
        );

        CREATE TABLE IF NOT EXISTS user_notification_preferences (
            user_email TEXT PRIMARY KEY,
            preferences TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

        // Idempotent LWW / soft-delete timestamp columns across synced SQLite tables
        for (const tbl of ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements']) {
            try { sqliteDb.exec(`ALTER TABLE ${tbl} ADD COLUMN updated_at TEXT;`); } catch (_) { }
            try { sqliteDb.exec(`ALTER TABLE ${tbl} ADD COLUMN deleted_at TEXT;`); } catch (_) { }
        }
        for (const trigCfg of [
            { tbl: 'users', pk: 'id' },
            { tbl: 'classrooms', pk: 'id' },
            { tbl: 'enrollments', pk: 'id' },
            { tbl: 'classwork', pk: 'id' },
            { tbl: 'submissions', pk: 'id' },
            { tbl: 'grades', pk: 'id' },
            { tbl: 'announcements', pk: 'id' }
        ]) {
            try {
                sqliteDb.exec(`
                    CREATE TRIGGER IF NOT EXISTS trg_${trigCfg.tbl}_updated_at
                    AFTER UPDATE ON ${trigCfg.tbl}
                    WHEN COALESCE(NEW.updated_at, '') = COALESCE(OLD.updated_at, '')
                    BEGIN
                        UPDATE ${trigCfg.tbl} SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ${trigCfg.pk} = NEW.${trigCfg.pk};
                    END;
                `);
            } catch (_) { }
        }

        // Opt-in initial admin bootstrap via environment variables only (no hardcoded default credentials)
        const bootstrapEmail = (process.env.VERITY_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
        const bootstrapPass = (process.env.VERITY_BOOTSTRAP_ADMIN_PASSWORD || '').trim();
        const bootstrapName = (process.env.VERITY_BOOTSTRAP_ADMIN_NAME || 'System Admin').trim();
        if (bootstrapEmail && bootstrapPass) {
            const adminCount = sqliteDb.prepare('SELECT count(*) as c FROM admin_users').get()?.c || 0;
            if (adminCount === 0) {
                const hashedPass = isHashedPassword(bootstrapPass) ? bootstrapPass : hashPassword(bootstrapPass);
                sqliteDb.prepare(
                    `INSERT OR IGNORE INTO admin_users (name, email, password, role, status) VALUES (?, ?, ?, 'Admin', 'Active')`
                ).run(bootstrapName, bootstrapEmail, hashedPass);
                console.log(`[Database] Provisioned bootstrap admin account for ${bootstrapEmail}.`);
            }
        }

        try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN instructor_email TEXT;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN description TEXT;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN settings TEXT;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN theme TEXT;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN archived INTEGER DEFAULT 0;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN avatar TEXT;`); } catch (e) { }
        try { sqliteDb.exec(`ALTER TABLE security_flags ADD COLUMN alt_tab_copy_paste_count INTEGER DEFAULT 0;`); } catch (e) { }

        try {
            sqliteDb.exec(`
            INSERT OR IGNORE INTO admin_users (name, email, password, role, lastLogin, status, avatar)
            SELECT name, email, password, role, lastLogin, status, avatar FROM users WHERE LOWER(role) = 'admin' OR LOWER(email) = 'admin@verity.com';
            DELETE FROM users WHERE LOWER(role) = 'admin' OR LOWER(email) = 'admin@verity.com';
        `);
        } catch (e) {
            console.warn('[Database] admin_users migration notice:', e.message);
        }

        // Ensure all classrooms have a unique class code and create unique index
        try {
            const rows = sqliteDb.prepare('SELECT id, code FROM classrooms').all();
            const taken = new Set();
            const duplicatesOrEmpty = [];
            for (const r of rows) {
                const c = (r.code || '').trim().toLowerCase();
                if (!c || taken.has(c)) {
                    duplicatesOrEmpty.push(r);
                } else {
                    taken.add(c);
                }
            }
            const updateStmt = sqliteDb.prepare('UPDATE classrooms SET code = ? WHERE id = ?');
            for (const r of duplicatesOrEmpty) {
                const newCode = generateClassCodeSync(taken);
                updateStmt.run(newCode, r.id);
            }
            sqliteDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_classrooms_unique_code ON classrooms(code);`);
        } catch (migErr) {
            console.warn('[Database] Classroom code migration notice (SQLite):', migErr.message);
        }

        provider = 'sqlite';
        seedFromDatabaseJson(sqliteDb, DATA_DIR);
        console.log(`[Database] Connected to SQLite (Local Storage, engine: ${sqliteDb.engine}): ${DB_FILE}`);
        return sqliteDb;
    } catch (err) {
        console.error('[Database] Failed to initialize SQLite:', err.message);
    }
}

function parseDatabaseUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let url = raw.trim();

    // 1. Remove wrapping quotes if present
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1).trim();
    }

    // 2. Extract URL if prefixed with "psql "
    const psqlMatch = url.match(/postgres(?:ql)?:\/\/[^\s'"]+/);
    if (psqlMatch) {
        url = psqlMatch[0];
    }

    // 3. Check for placeholders
    const hasPlaceholder = url.includes('[YOUR-PASSWORD]') ||
        url.includes('[PASSWORD]') ||
        url.includes(':YOUR-PASSWORD@') ||
        url.includes(':PASSWORD@');

    // 4. Auto-strip brackets around password ONLY if user typed :[myActualPassword]@
    if (!hasPlaceholder) {
        url = url.replace(/:\[([^\]]+)\]@/, ':$1@');
    }

    // 5. Automatically encode special characters (% and ?) in passwords if unencoded
    const authMatch = url.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
    if (authMatch && !hasPlaceholder) {
        const [, prefix, rawPass, suffix] = authMatch;
        if (!rawPass.includes('%25') && (rawPass.includes('%') || rawPass.includes('?'))) {
            url = `${prefix}${encodeURIComponent(rawPass)}${suffix}`;
        }
    }

    // 6. Fix IPv6-only db.*.supabase.co for IPv4-only cloud environments (e.g., Render, Docker)
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

    return { url, hasPlaceholder };
}

const parsedDb = parseDatabaseUrl(DATABASE_URL);
const cleanedUrl = parsedDb ? parsedDb.url : null;

async function initPostgres(connStr = cleanedUrl) {
    const { Pool } = require('pg');
    // Supabase requires SSL with rejectUnauthorized: false in Node environments
    const isSupabase = connStr.includes('supabase.co') || connStr.includes('pooler.supabase.com');
    const sslConfig = isSupabase || process.env.PG_SSL === 'true' || !connStr.includes('localhost')
        ? { rejectUnauthorized: false }
        : undefined;

    pgPool = new Pool({
        connectionString: connStr,
        ssl: sslConfig,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 4000,
        query_timeout: 8000,
    });

    // Without an 'error' listener, an idle-client network error crashes the whole Node process
    pgPool.on('error', (err) => {
        console.warn('[Database] PostgreSQL idle client error:', err.message);
    });

    // Test connection
    const client = await pgPool.connect();
    pgEverConnected = true;
    try {
        console.log('[Database] Successfully connected to PostgreSQL / Supabase!');

        // Prevent long lock acquisitions from hanging the server and deadlocking incoming queries
        try {
            await client.query("SET lock_timeout = '2000ms';");
            await client.query("SET statement_timeout = '5000ms';");
        } catch (_) { }

        // Check if schema already exists
        const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1;").catch(() => ({ rows: [] }));
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
            const schemaPath = [
                path.join(__dirname, 'schema.sql'),
                path.join(__dirname, 'db', 'schema.sql'),
                path.join(__dirname, '..', 'server', 'db', 'schema.sql')
            ].find((p) => fs.existsSync(p));
            if (schemaPath) {
                const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                await client.query(schemaSql).catch(err => console.warn('[Database] Initial schema note:', err.message));
            }
        }

        console.log('[Database] PostgreSQL schema verified/initialized.');
        await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS archived INTEGER DEFAULT 0;').catch(() => {});
        await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS description TEXT;').catch(() => {});
        await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS settings TEXT;').catch(() => {});
        for (const tbl of ['users', 'admin_users', 'classrooms', 'enrollments', 'classwork', 'submissions', 'grades', 'announcements']) {
            await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`).catch(() => {});
            await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`).catch(() => {});
        }
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_deletions (
                table_name VARCHAR(64) NOT NULL,
                record_key VARCHAR(255) NOT NULL,
                deleted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (table_name, record_key)
            );
        `).catch(() => {});
        await client.query(`
            CREATE TABLE IF NOT EXISTS email_notifications_log (
                id BIGSERIAL PRIMARY KEY,
                notification_type VARCHAR(64) NOT NULL,
                classroom_id BIGINT,
                assignment_id BIGINT,
                student_email VARCHAR(255) NOT NULL,
                due_date_snapshot TEXT,
                status VARCHAR(32) DEFAULT 'sent',
                sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(notification_type, assignment_id, student_email)
            );
        `).catch(() => {});
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_notification_preferences (
                user_email VARCHAR(255) PRIMARY KEY,
                preferences TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `).catch(() => {});

        const pgBootstrapEmail = (process.env.VERITY_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
        const pgBootstrapPass = (process.env.VERITY_BOOTSTRAP_ADMIN_PASSWORD || '').trim();
        const pgBootstrapName = (process.env.VERITY_BOOTSTRAP_ADMIN_NAME || 'System Admin').trim();
        if (pgBootstrapEmail && pgBootstrapPass) {
            const pgAdminCount = await client.query('SELECT count(*) AS c FROM admin_users').catch(() => ({ rows: [{ c: 0 }] }));
            if (Number(pgAdminCount.rows?.[0]?.c || 0) === 0) {
                const hashedPass = isHashedPassword(pgBootstrapPass) ? pgBootstrapPass : hashPassword(pgBootstrapPass);
                await client.query(
                    `INSERT INTO admin_users (name, email, password, role, status) VALUES ($1, $2, $3, 'Admin', 'Active') ON CONFLICT (email) DO NOTHING`,
                    [pgBootstrapName, pgBootstrapEmail, hashedPass]
                ).catch(() => {});
            }
        }

        provider = 'postgres';

        // Synchronize active Postgres users with local SQLite so offline cache matches the primary database
        if (sqliteDb) {
            try {
                // 1. Sync regular users (Teachers & Students) with passwords for offline login
                const pgUsers = await client.query('SELECT id, name, email, password, role, status, lastlogin, avatar FROM users ORDER BY id ASC').catch(() => ({ rows: [] }));
                if (pgUsers.rows && pgUsers.rows.length > 0) {
                    const findIdConflict = sqliteDb.prepare('SELECT id, email FROM users WHERE id = ? AND LOWER(email) != LOWER(?)');
                    const moveConflictId = sqliteDb.prepare('UPDATE users SET id = ? WHERE id = ?');
                    const upsertUserByEmail = sqliteDb.prepare(`
                        INSERT INTO users (id, name, email, password, role, status, lastLogin, avatar)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(email) DO UPDATE SET
                            id = excluded.id,
                            name = excluded.name,
                            password = excluded.password,
                            role = excluded.role,
                            status = excluded.status,
                            lastLogin = excluded.lastLogin,
                            avatar = COALESCE(excluded.avatar, users.avatar)
                    `);
                    for (const u of pgUsers.rows) {
                        if (u.email) {
                            try {
                                const conflict = findIdConflict.get(u.id, u.email);
                                if (conflict) {
                                    moveConflictId.run(Number(u.id) + 900000000 + Math.floor(Math.random() * 100000), u.id);
                                }
                                upsertUserByEmail.run(u.id, u.name || '', u.email, u.password || '', u.role || 'Student', u.status || 'Active', u.lastlogin || null, u.avatar || null);
                            } catch (_) {
                                try {
                                    sqliteDb.prepare(`
                                        INSERT INTO users (name, email, password, role, status, lastLogin, avatar)
                                        VALUES (?, ?, ?, ?, ?, ?, ?)
                                        ON CONFLICT(email) DO UPDATE SET
                                            name = excluded.name,
                                            password = excluded.password,
                                            role = excluded.role,
                                            status = excluded.status,
                                            lastLogin = excluded.lastLogin,
                                            avatar = COALESCE(excluded.avatar, users.avatar)
                                    `).run(u.name || '', u.email, u.password || '', u.role || 'Student', u.status || 'Active', u.lastlogin || null, u.avatar || null);
                                } catch (_) { }
                            }
                        }
                    }
                    console.log(`[Database] Synced ${pgUsers.rows.length} users from Supabase into local SQLite.`);
                }

                // 2. Sync admin users
                const pgAdmins = await client.query('SELECT id, name, email, password, role, status, lastlogin, avatar FROM admin_users').catch(() => ({ rows: [] }));
                if (pgAdmins.rows && pgAdmins.rows.length > 0) {
                    const upsertAdmin = sqliteDb.prepare(`
                        INSERT INTO admin_users (id, name, email, password, role, status, lastLogin, avatar)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(email) DO UPDATE SET
                            name = excluded.name,
                            password = excluded.password,
                            role = excluded.role,
                            status = excluded.status,
                            lastLogin = excluded.lastLogin,
                            avatar = excluded.avatar
                    `);
                    for (const a of pgAdmins.rows) {
                        if (a.email) {
                            try {
                                upsertAdmin.run(a.id, a.name || '', a.email, a.password || '', a.role || 'Admin', a.status || 'Active', a.lastlogin || null, a.avatar || null);
                            } catch (_) { }
                        }
                    }
                }

                // 3. Sync classrooms
                const pgClassrooms = await client.query('SELECT id, code, section, name, subject, instructor, instructor_email, description, settings, theme, archived FROM classrooms').catch(() => ({ rows: [] }));
                if (pgClassrooms.rows && pgClassrooms.rows.length > 0) {
                    const upsertClassroom = sqliteDb.prepare(`
                        INSERT INTO classrooms (id, code, section, name, subject, instructor, instructor_email, description, settings, theme, archived)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            code = excluded.code,
                            section = excluded.section,
                            name = excluded.name,
                            subject = excluded.subject,
                            instructor = excluded.instructor,
                            instructor_email = excluded.instructor_email,
                            description = excluded.description,
                            settings = excluded.settings,
                            theme = excluded.theme,
                            archived = excluded.archived
                    `);
                    let cCount = 0;
                    for (const c of pgClassrooms.rows) {
                        try {
                            upsertClassroom.run(c.id, c.code || '', c.section || '', c.name || '', c.subject || '', c.instructor || '', c.instructor_email || null, c.description || '', c.settings || null, c.theme || null, c.archived ? 1 : 0);
                            cCount++;
                        } catch (_) { }
                    }
                    console.log(`[Database] Synced ${cCount} classrooms from Supabase into local SQLite.`);
                }

                // 4. Sync classwork / exams
                const pgClasswork = await client.query('SELECT id, classroom_id, title, description, duedate, type, created_at FROM classwork').catch(() => ({ rows: [] }));
                if (pgClasswork.rows && pgClasswork.rows.length > 0) {
                    const upsertCw = sqliteDb.prepare(`
                        INSERT INTO classwork (id, classroom_id, title, description, dueDate, type, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            classroom_id = excluded.classroom_id,
                            title = excluded.title,
                            description = excluded.description,
                            dueDate = excluded.dueDate,
                            type = excluded.type,
                            created_at = excluded.created_at
                    `);
                    let cwCount = 0;
                    for (const cw of pgClasswork.rows) {
                        try {
                            upsertCw.run(cw.id, cw.classroom_id, cw.title, cw.description, cw.duedate, cw.type || '', cw.created_at ? new Date(cw.created_at).toISOString() : null);
                            cwCount++;
                        } catch (_) { }
                    }
                    console.log(`[Database] Synced ${cwCount} classwork activities from Supabase into local SQLite.`);
                }

                // 5. Sync enrollments (do NOT insert id to prevent UNIQUE constraint collisions on autoincrement PK)
                const pgEnrollments = await client.query('SELECT classroom_id, student_id, student_name, student_email, enrolled_at FROM enrollments').catch(() => ({ rows: [] }));
                if (pgEnrollments.rows && pgEnrollments.rows.length > 0) {
                    const upsertEnrollment = sqliteDb.prepare(`
                        INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(classroom_id, student_email) DO UPDATE SET
                            student_id = excluded.student_id,
                            student_name = excluded.student_name,
                            enrolled_at = excluded.enrolled_at
                    `);
                    let enCount = 0;
                    for (const en of pgEnrollments.rows) {
                        if (en.classroom_id && en.student_email) {
                            try {
                                upsertEnrollment.run(
                                    en.classroom_id,
                                    en.student_id || null,
                                    en.student_name || '',
                                    en.student_email.trim().toLowerCase(),
                                    en.enrolled_at ? new Date(en.enrolled_at).toISOString() : null
                                );
                                enCount++;
                            } catch (_) { }
                        }
                    }
                    console.log(`[Database] Synced ${enCount} enrollments from Supabase into local SQLite.`);
                }

                // 6. Sync student submissions (activities & code)
                const pgSubmissions = await client.query('SELECT id, assignment_id, student_name, history, submittedat FROM submissions').catch(() => ({ rows: [] }));
                if (pgSubmissions.rows && pgSubmissions.rows.length > 0) {
                    const dedupSub = sqliteDb.prepare('DELETE FROM submissions WHERE assignment_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)) AND id != ?');
                    const upsertSub = sqliteDb.prepare(`
                        INSERT INTO submissions (id, assignment_id, student_name, history, submittedAt)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            assignment_id = excluded.assignment_id,
                            student_name = excluded.student_name,
                            history = excluded.history,
                            submittedAt = excluded.submittedAt
                    `);
                    for (const s of pgSubmissions.rows) {
                        try {
                            dedupSub.run(s.assignment_id, s.student_name || '', s.id);
                            upsertSub.run(s.id, s.assignment_id, s.student_name, s.history, s.submittedat || s.submittedAt || null);
                        } catch (_) { }
                    }
                    console.log(`[Database] Synced ${pgSubmissions.rows.length} submissions from Supabase into local SQLite.`);
                }

                // 7. Sync grades (do NOT insert id to prevent UNIQUE constraint collisions on autoincrement PK)
                const pgGrades = await client.query('SELECT assignment_id, student_id, grade, feedback, graded_at FROM grades').catch(() => ({ rows: [] }));
                if (pgGrades.rows && pgGrades.rows.length > 0) {
                    const upsertGrade = sqliteDb.prepare(`
                        INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(assignment_id, student_id) DO UPDATE SET
                            grade = excluded.grade,
                            feedback = excluded.feedback,
                            graded_at = excluded.graded_at
                    `);
                    let gCount = 0;
                    for (const g of pgGrades.rows) {
                        try {
                            upsertGrade.run(String(g.assignment_id), String(g.student_id), g.grade || '', g.feedback || '', g.graded_at ? new Date(g.graded_at).toISOString() : null);
                            gCount++;
                        } catch (_) { }
                    }
                    console.log(`[Database] Synced ${gCount} grades from Supabase into local SQLite.`);
                }

                // 8. Sync announcements
                const pgAnnouncements = await client.query('SELECT id, classroom_id, title, details, author, posted, created_at FROM announcements').catch(() => ({ rows: [] }));
                if (pgAnnouncements.rows && pgAnnouncements.rows.length > 0) {
                    const upsertAnn = sqliteDb.prepare(`
                        INSERT INTO announcements (id, classroom_id, title, details, author, posted, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            classroom_id = excluded.classroom_id,
                            title = excluded.title,
                            details = excluded.details,
                            author = excluded.author,
                            posted = excluded.posted,
                            created_at = excluded.created_at
                    `);
                    let anCount = 0;
                    for (const an of pgAnnouncements.rows) {
                        try {
                            upsertAnn.run(an.id, an.classroom_id, an.title || '', an.details || '', an.author || '', an.posted || null, an.created_at || null);
                            anCount++;
                        } catch (_) { }
                    }
                    console.log(`[Database] Synced ${anCount} announcements from Supabase into local SQLite.`);
                }
            } catch (syncErr) {
                console.warn('[Database] Data sync warning:', syncErr.message);
            }
        }
    } catch (err) {
        console.warn('[Database] Schema verification notice:', err.message);
        provider = 'postgres';
    } finally {
        client.release();
    }
}

// --- PostgreSQL auto-recovery ---
// Previously, a single network hiccup (or a slow cold-start connection) flipped the provider to SQLite
// PERMANENTLY. On Render, that SQLite file is ephemeral, so the Online server silently served stale/empty
// data (e.g. Admin "Global Classrooms" showing nothing). We now fall back temporarily and keep retrying.
let pgEverConnected = false;
let reconnectTimer = null;
const RECONNECT_INTERVAL_MS = 15000;

function scheduleReconnect() {
    if (reconnectTimer || !cleanedUrl || (parsedDb && parsedDb.hasPlaceholder)) return;
    reconnectTimer = setInterval(async () => {
        if (provider === 'postgres') {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
            return;
        }
        try {
            if (!pgEverConnected || !pgPool) {
                // Initial boot never reached Postgres: rebuild the pool and run the full initial sync
                if (pgPool) { try { await pgPool.end(); } catch (_) { } pgPool = null; }
                await initPostgres(cleanedUrl);
            } else {
                await pgPool.query('SELECT 1');
                provider = 'postgres';
            }
            if (provider === 'postgres') {
                console.log('[Database] PostgreSQL connection restored. Switched back from SQLite fallback.');
                clearInterval(reconnectTimer);
                reconnectTimer = null;
                // Push any writes made while in fallback mode up to Supabase
                try { require('./cloudSync').triggerSync(); } catch (_) { }
            }
        } catch (err) {
            console.warn(`[Database] PostgreSQL reconnect attempt failed: ${err.message}`);
        }
    }, RECONNECT_INTERVAL_MS);
    if (reconnectTimer.unref) reconnectTimer.unref();
}

function fallBackToSqlite(err) {
    console.warn(`[Database] PostgreSQL connection lost (${err && err.message}). Temporarily using local SQLite; will keep retrying PostgreSQL.`);
    if (!sqliteDb) initSqlite();
    provider = 'sqlite';
    scheduleReconnect();
}

function isNetworkError(err) {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    const code = String(err.code || '');
    // A single slow statement (statement_timeout) is not a lost connection
    if (code === '57014') return false;
    return code === 'ECONNREFUSED' ||
        code === 'ENETUNREACH' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        code === '57P01' ||
        msg.includes('connection terminated') ||
        msg.includes('client has already been closed') ||
        msg.includes('timeout') ||
        msg.includes('getaddrinfo') ||
        msg.includes('connection error');
}

// Initialization promise
const readyPromise = (async () => {
    // ALWAYS initialize local SQLite first so offline fallback is ready instantly
    initSqlite();

    if (cleanedUrl) {
        if (parsedDb && parsedDb.hasPlaceholder) {
            console.error('[Database] Configuration Error: Your DATABASE_URL still contains the placeholder "[YOUR-PASSWORD]".');
            console.error('[Database] Please go to Render Dashboard -> Environment -> edit DATABASE_URL and replace [YOUR-PASSWORD] with your actual Supabase database password.');
            provider = 'sqlite';
        } else if (!cleanedUrl.startsWith('postgres://') && !cleanedUrl.startsWith('postgresql://')) {
            console.error(`[Database] Provided DATABASE_URL is not recognized as a PostgreSQL URL (must start with postgresql:// or postgres://).`);
            provider = 'sqlite';
        } else {
            try {
                console.log('[Database] Attempting connection to PostgreSQL...');
                await initPostgres(cleanedUrl);
            } catch (err) {
                console.warn(`[Database] PostgreSQL connection failed: ${err.message}`);
                if (err.code === 'ENETUNREACH' || (cleanedUrl.includes('db.') && cleanedUrl.includes('.supabase.co'))) {
                    console.warn('[Database] IPv6 Error: Render does not support direct IPv6 connections (db.*.supabase.co).');
                    console.warn('[Database] Fix: In your Supabase Dashboard, click "Connect" -> select "Connection Pooler" (pooler.supabase.com:6543 or 5432) which supports IPv4!');
                }
                console.warn('[Database] Falling back to local SQLite so your app stays fully functional. Will keep retrying PostgreSQL.');
                provider = 'sqlite';
                scheduleReconnect();
            }
        }
    } else {
        if (DATABASE_URL && DATABASE_URL.trim().length > 0) {
            console.warn(`[Database] Provided DATABASE_URL is not a valid PostgreSQL connection string. Falling back to local SQLite.`);
        } else {
            console.log('[Database] No DATABASE_URL found. Running with local SQLite database.');
        }
        provider = 'sqlite';
    }

    // Initialize continuous differential cloud sync engine
    try {
        const { initCloudSync } = require('./cloudSync');
        initCloudSync(sqliteDb, cleanedUrl || DATABASE_URL);
    } catch (syncInitErr) {
        console.warn('[Database] Cloud sync initialization notice:', syncInitErr.message);
    }
})();

const db = {
    ready: () => readyPromise,
    get isPostgres() { return provider === 'postgres'; },
    get providerName() { return provider === 'postgres' ? 'PostgreSQL (Supabase)' : 'SQLite (Local Fallback)'; },

    syncWithCloud: () => {
        try {
            const { syncBidirectional } = require('./cloudSync');
            return syncBidirectional();
        } catch (_) {
            return Promise.resolve({ status: 'error' });
        }
    },
    triggerSync: () => {
        try {
            const { triggerSync } = require('./cloudSync');
            return triggerSync();
        } catch (_) { }
    },
    getSyncStatus: () => {
        try {
            const { getSyncStatus } = require('./cloudSync');
            return getSyncStatus();
        } catch (_) {
            return { isSyncing: false, lastSyncStatus: 'idle' };
        }
    },

    async recordSyncDeletion(tableName, recordKey) {
        if (!tableName || recordKey == null) return;
        const t = String(tableName).trim().toLowerCase();
        const k = String(recordKey).trim();
        if (!t || !k) return;
        const ts = new Date().toISOString();
        try {
            await readyPromise;
            if (sqliteDb) {
                sqliteDb.prepare(`
                    INSERT INTO sync_deletions (table_name, record_key, deleted_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(table_name, record_key) DO UPDATE SET deleted_at = excluded.deleted_at
                `).run(t, k, ts);
            }
            if (provider === 'postgres' && pgPool) {
                await pgPool.query(`
                    INSERT INTO sync_deletions (table_name, record_key, deleted_at)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (table_name, record_key) DO UPDATE SET deleted_at = EXCLUDED.deleted_at
                `, [t, k, ts]).catch(() => { });
            }
        } catch (_) { }
    },

    async clearSyncDeletion(tableName, recordKey) {
        if (!tableName || recordKey == null) return;
        const t = String(tableName).trim().toLowerCase();
        const k = String(recordKey).trim();
        if (!t || !k) return;
        try {
            await readyPromise;
            if (sqliteDb) {
                sqliteDb.prepare('DELETE FROM sync_deletions WHERE table_name = ? AND record_key = ?').run(t, k);
            }
            if (provider === 'postgres' && pgPool) {
                await pgPool.query('DELETE FROM sync_deletions WHERE table_name = $1 AND record_key = $2', [t, k]).catch(() => { });
            }
        } catch (_) { }
    },

    // Execute query and return all matching rows as Array
    async all(sql, ...args) {
        await readyPromise;
        const params = normalizeParams(args);
        if (provider === 'postgres') {
            try {
                const pgSql = convertPlaceholders(sql);
                const res = await pgPool.query(pgSql, params);
                return res.rows.map(normalizeRow);
            } catch (err) {
                if (isNetworkError(err)) {
                    fallBackToSqlite(err);
                    return sqliteDb.prepare(sql).all(...params);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            return sqliteDb.prepare(sql).all(...params);
        }
    },

    // Execute query and return the first matching row or undefined
    async get(sql, ...args) {
        await readyPromise;
        const params = normalizeParams(args);
        if (provider === 'postgres') {
            try {
                const pgSql = convertPlaceholders(sql);
                const res = await pgPool.query(pgSql, params);
                return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
            } catch (err) {
                if (isNetworkError(err)) {
                    fallBackToSqlite(err);
                    return sqliteDb.prepare(sql).get(...params);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            return sqliteDb.prepare(sql).get(...params);
        }
    },

    // Execute INSERT, UPDATE, DELETE and return { lastInsertRowid, changes }
    async run(sql, ...args) {
        await readyPromise;
        const params = normalizeParams(args);
        if (provider === 'postgres') {
            try {
                let pgSql = convertPlaceholders(sql);
                const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
                const hasReturning = /RETURNING/i.test(pgSql);
                const isIdLessTable = /INSERT\s+INTO\s+(?:system_settings|security_flags|user_notification_preferences)\b/i.test(pgSql);
                if (isInsert && !hasReturning && !isIdLessTable) {
                    pgSql += ' RETURNING id';
                }
                let res;
                try {
                    res = await pgPool.query(pgSql, params);
                } catch (err) {
                    if (err && err.code === '42703' && pgSql.includes('RETURNING id')) {
                        // Fallback: column "id" does not exist in this table
                        res = await pgPool.query(convertPlaceholders(sql), params);
                    } else {
                        throw err;
                    }
                }
                const rawId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
                const lastId = rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : rawId;

                // DUAL-WRITE: Mirror mutation into local SQLite database
                if (sqliteDb) {
                    try {
                        sqliteDb.prepare(sql).run(...params);
                    } catch (_) { }
                }

                // Trigger differential cloud sync to reconcile mutations with local SQLite
                try {
                    const { triggerSync } = require('./cloudSync');
                    triggerSync();
                } catch (_) { }

                return {
                    lastInsertRowid: lastId,
                    changes: res.rowCount || 0
                };
            } catch (err) {
                if (isNetworkError(err)) {
                    fallBackToSqlite(err);
                    return sqliteDb.prepare(sql).run(...params);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            const stmt = sqliteDb.prepare(sql);
            const res = stmt.run(...params);

            // DUAL-WRITE: Mirror mutation into PostgreSQL if pool is available
            if (pgPool) {
                try {
                    let pgSql = convertPlaceholders(sql);
                    const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
                    const hasReturning = /RETURNING/i.test(pgSql);
                    const isIdLessTable = /INSERT\s+INTO\s+(?:system_settings|security_flags|user_notification_preferences)\b/i.test(pgSql);
                    if (isInsert && !hasReturning && !isIdLessTable) {
                        pgSql += ' RETURNING id';
                    }
                    pgPool.query(pgSql, params).catch(() => { });
                } catch (_) { }
            }

            // Trigger differential cloud sync to reconcile mutations with Supabase
            try {
                const { triggerSync } = require('./cloudSync');
                triggerSync();
            } catch (_) { }

            return res;
        }
    },

    // Execute raw multiple SQL statements (DDL)
    async exec(sql) {
        await readyPromise;
        if (provider === 'postgres') {
            try {
                return await pgPool.query(sql);
            } catch (err) {
                if (isNetworkError(err)) {
                    fallBackToSqlite(err);
                    return sqliteDb.exec(sql);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            return sqliteDb.exec(sql);
        }
    },

    // Statement-like helper for compatibility
    prepare(sql) {
        return {
            get: (...args) => db.get(sql, ...args),
            all: (...args) => db.all(sql, ...args),
            run: (...args) => db.run(sql, ...args)
        };
    },

    // Transaction runner
    async transaction(callback) {
        await readyPromise;
        if (provider === 'postgres') {
            try {
                const client = await pgPool.connect();
                try {
                    await client.query('BEGIN');
                    const txObj = {
                        get: async (sql, ...args) => {
                            const params = normalizeParams(args);
                            const res = await client.query(convertPlaceholders(sql), params);
                            return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
                        },
                        all: async (sql, ...args) => {
                            const params = normalizeParams(args);
                            const res = await client.query(convertPlaceholders(sql), params);
                            return res.rows.map(normalizeRow);
                        },
                        run: async (sql, ...args) => {
                            const params = normalizeParams(args);
                            let pgSql = convertPlaceholders(sql);
                            const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
                            const hasReturning = /RETURNING/i.test(pgSql);
                            if (isInsert && !hasReturning) {
                                pgSql += ' RETURNING id';
                            }
                            const res = await client.query(pgSql, params);
                            const rawId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
                            const lastId = rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : rawId;
                            return {
                                lastInsertRowid: lastId,
                                changes: res.rowCount || 0
                            };
                        },
                        prepare: (sql) => ({
                            get: (...args) => txObj.get(sql, ...args),
                            all: (...args) => txObj.all(sql, ...args),
                            run: (...args) => txObj.run(sql, ...args)
                        })
                    };
                    const result = await callback(txObj);
                    await client.query('COMMIT');
                    return result;
                } catch (e) {
                    await client.query('ROLLBACK');
                    throw e;
                } finally {
                    client.release();
                }
            } catch (connErr) {
                if (isNetworkError(connErr)) {
                    fallBackToSqlite(connErr);
                    return sqliteDb.transaction(async () => {
                        return callback(db);
                    })();
                }
                throw connErr;
            }
        } else {
            if (!sqliteDb) initSqlite();
            return sqliteDb.transaction(async () => {
                return callback(db);
            })();
        }
    },

    // Close connections
    async close() {
        if (pgPool) await pgPool.end();
        if (sqliteDb) sqliteDb.close();
    },

    getSqliteDb() {
        if (!sqliteDb) initSqlite();
        return sqliteDb;
    },

    getPgPool() {
        return pgPool;
    },

    /**
     * Persists a local uploaded file in 1 MB chunks to PostgreSQL (and SQLite)
     * as a cross-device persistence fallback when Cloudflare R2 is not configured.
     */
    async persistUploadToCloudDb(filename, filePath, mimeType = 'application/octet-stream', maxBytes = 50 * 1024 * 1024) {
        try {
            if (!filename || !filePath || !fs.existsSync(filePath)) return false;
            const stat = fs.statSync(filePath);
            if (stat.size <= 0 || stat.size > maxBytes) return false;

            const CHUNK_SIZE = 1024 * 1024; // 1 MB chunks
            const totalChunks = Math.ceil(stat.size / CHUNK_SIZE);
            const fd = fs.openSync(filePath, 'r');
            const chunks = [];
            try {
                for (let idx = 0; idx < totalChunks; idx++) {
                    const offset = idx * CHUNK_SIZE;
                    const len = Math.min(CHUNK_SIZE, stat.size - offset);
                    const buf = Buffer.allocUnsafe(len);
                    fs.readSync(fd, buf, 0, len, offset);
                    chunks.push(buf);
                }
            } finally {
                fs.closeSync(fd);
            }

            // Try PostgreSQL (Supabase) first so all devices & Render instances can read it
            let pool = pgPool;
            if (!pool && DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
                try {
                    const { Pool } = require('pg');
                    pool = new Pool({
                        connectionString: DATABASE_URL,
                        ssl: { rejectUnauthorized: false },
                        connectionTimeoutMillis: 4000,
                        idleTimeoutMillis: 20000,
                        max: 3
                    });
                    pgPool = pool;
                } catch (_) { }
            }

            if (pool) {
                try {
                    const client = await pool.connect();
                    try {
                        await client.query(`
                            CREATE TABLE IF NOT EXISTS uploaded_files (
                                filename VARCHAR(255) PRIMARY KEY,
                                mime_type VARCHAR(120) DEFAULT 'application/octet-stream',
                                size_bytes BIGINT DEFAULT 0,
                                chunk_count INTEGER DEFAULT 0,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            )
                        `);
                        await client.query(`
                            CREATE TABLE IF NOT EXISTS uploaded_file_chunks (
                                filename VARCHAR(255) NOT NULL,
                                chunk_index INTEGER NOT NULL,
                                data BYTEA NOT NULL,
                                PRIMARY KEY (filename, chunk_index)
                            )
                        `);
                        await client.query('BEGIN');
                        await client.query('DELETE FROM uploaded_file_chunks WHERE filename = $1', [filename]);
                        await client.query(`
                            INSERT INTO uploaded_files (filename, mime_type, size_bytes, chunk_count)
                            VALUES ($1, $2, $3, $4)
                            ON CONFLICT (filename) DO UPDATE SET
                                mime_type = EXCLUDED.mime_type,
                                size_bytes = EXCLUDED.size_bytes,
                                chunk_count = EXCLUDED.chunk_count,
                                created_at = CURRENT_TIMESTAMP
                        `, [filename, mimeType, stat.size, totalChunks]);
                        for (let i = 0; i < chunks.length; i++) {
                            await client.query(
                                'INSERT INTO uploaded_file_chunks (filename, chunk_index, data) VALUES ($1, $2, $3)',
                                [filename, i, chunks[i]]
                            );
                        }
                        await client.query('COMMIT');
                        console.log(`[Media DB Fallback] Persisted ${filename} (${stat.size} bytes, ${totalChunks} chunks) to PostgreSQL`);
                        return true;
                    } catch (txErr) {
                        try { await client.query('ROLLBACK'); } catch (_) { }
                        console.warn(`[Media DB Fallback] PG persist failed for ${filename}:`, txErr.message);
                    } finally {
                        client.release();
                    }
                } catch (connErr) {
                    console.warn(`[Media DB Fallback] PG connect notice for ${filename}:`, connErr.message);
                }
            }
            return false;
        } catch (err) {
            console.warn(`[Media DB Fallback] Persist error for ${filename}:`, err.message);
            return false;
        }
    },

    /**
     * Restores a missing /uploads/<filename> from PostgreSQL chunk storage into targetPath.
     */
    async restoreUploadFromCloudDb(filename, targetPath) {
        try {
            if (!filename || !targetPath) return false;
            if (fs.existsSync(targetPath)) return true;

            let pool = pgPool;
            if (!pool && DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
                try {
                    const { Pool } = require('pg');
                    pool = new Pool({
                        connectionString: DATABASE_URL,
                        ssl: { rejectUnauthorized: false },
                        connectionTimeoutMillis: 4000,
                        idleTimeoutMillis: 20000,
                        max: 3
                    });
                    pgPool = pool;
                } catch (_) { }
            }
            if (!pool) return false;

            const client = await pool.connect();
            try {
                const metaRes = await client.query(
                    'SELECT filename, chunk_count FROM uploaded_files WHERE filename = $1',
                    [filename]
                );
                if (!metaRes.rows || metaRes.rows.length === 0) return false;

                const chunkRes = await client.query(
                    'SELECT chunk_index, data FROM uploaded_file_chunks WHERE filename = $1 ORDER BY chunk_index ASC',
                    [filename]
                );
                if (!chunkRes.rows || chunkRes.rows.length === 0) return false;

                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const partPath = `${targetPath}.${Date.now()}.dbpart`;
                const ws = fs.createWriteStream(partPath);
                try {
                    for (const row of chunkRes.rows) {
                        const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
                        ws.write(buf);
                    }
                    await new Promise((resolve, reject) => {
                        ws.on('finish', resolve);
                        ws.on('error', reject);
                        ws.end();
                    });
                    fs.renameSync(partPath, targetPath);
                    console.log(`[Media DB Fallback] Restored ${filename} from PostgreSQL into local cache`);
                    return true;
                } catch (writeErr) {
                    try { ws.destroy(); } catch (_) { }
                    try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (_) { }
                    return false;
                }
            } finally {
                client.release();
            }
        } catch (err) {
            return false;
        }
    },

    generateClassCodeSync
};

module.exports = db;
