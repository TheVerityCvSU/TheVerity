const path = require('path');
const fs = require('fs');
const { openSqliteDatabase } = require('./sqlite-adapter');

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

for (const p of envCandidates) {
    if (fs.existsSync(p)) {
        try {
            require('dotenv').config({ path: p });
        } catch (_) {}
    }
}

let provider = 'sqlite';
let pgPool = null;
let sqliteDb = null;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL;

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
                if (u.id) insertUser.run(u.id, u.name, u.email, u.password, u.role, u.lastLogin, u.status);
                else insertUserNoId.run(u.name, u.email, u.password, u.role, u.lastLogin, u.status);
            });
            console.log(`[Database] Seeded ${data.users.length} users into SQLite from database.json.`);
        }

        const classCount = adapter.prepare('SELECT count(*) as c FROM classrooms').get()?.c || 0;
        if (classCount === 0 && Array.isArray(data.classrooms) && data.classrooms.length > 0) {
            const insertClassroom = adapter.prepare('INSERT OR IGNORE INTO classrooms (id, code, section, name, subject, instructor) VALUES (?, ?, ?, ?, ?, ?)');
            data.classrooms.forEach(c => {
                insertClassroom.run(c.id, c.code || '', c.section || '', c.name || '', c.subject || '', c.instructor || '');
            });
            console.log(`[Database] Seeded ${data.classrooms.length} classrooms into SQLite from database.json.`);
        }

        const cwCount = adapter.prepare('SELECT count(*) as c FROM classwork').get()?.c || 0;
        if (cwCount === 0 && data.classwork && typeof data.classwork === 'object') {
            const insertClasswork = adapter.prepare('INSERT OR IGNORE INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, ?, ?, ?, ?, ?)');
            for (const [classroomId, cwArray] of Object.entries(data.classwork)) {
                if (Array.isArray(cwArray)) {
                    cwArray.forEach(cw => {
                        insertClasswork.run(cw.id, parseInt(classroomId, 10), cw.title, cw.description, cw.dueDate, cw.type || '');
                    });
                }
            }
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
            try { sqliteDb.pragma('journal_mode = WAL'); } catch (e) {}
        } else {
            try { sqliteDb.pragma('journal_mode = DELETE'); } catch (e) {}
        }
        try { sqliteDb.pragma('busy_timeout = 5000'); } catch (e) {}

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
            theme TEXT
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

        INSERT OR IGNORE INTO admin_users (name, email, password, role, status)
        VALUES ('System Admin', 'admin@verity.com', 'admin', 'Admin', 'Active');

        INSERT OR IGNORE INTO admin_users (name, email, password, role, status)
        VALUES ('System Admin', 'admin@verity.com', 'admin', 'Admin', 'Active');
    `);

    try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN instructor_email TEXT;`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE classrooms ADD COLUMN theme TEXT;`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN avatar TEXT;`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE security_flags ADD COLUMN alt_tab_copy_paste_count INTEGER DEFAULT 0;`); } catch (e) {}

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
        max: 15,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await pgPool.connect();
    try {
        console.log('[Database] Successfully connected to PostgreSQL / Supabase!');
        // Initialize schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await client.query(schemaSql);
        }
        try {
            await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS instructor_email VARCHAR(255);');
            await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS instructor VARCHAR(255);');
            await client.query('ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS theme TEXT;');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;');
            await client.query('ALTER TABLE security_flags ADD COLUMN IF NOT EXISTS alt_tab_copy_paste_count INTEGER DEFAULT 0;');
        } catch (colErr) {
            console.warn('[Database] Note on column migration:', colErr.message);
        }
        console.log('[Database] PostgreSQL schema verified/initialized.');
        provider = 'postgres';
    } finally {
        client.release();
    }
}

function isNetworkError(err) {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    const code = String(err.code || '');
    return code === 'ECONNREFUSED' ||
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
            console.error('❌ [Database] Configuration Error: Your DATABASE_URL still contains the placeholder "[YOUR-PASSWORD]".');
            console.error('👉 Please go to Render Dashboard -> Environment -> edit DATABASE_URL and replace [YOUR-PASSWORD] with your actual Supabase database password.');
            provider = 'sqlite';
        } else if (!cleanedUrl.startsWith('postgres://') && !cleanedUrl.startsWith('postgresql://')) {
            console.error(`❌ [Database] Provided DATABASE_URL is not recognized as a PostgreSQL URL (must start with postgresql:// or postgres://).`);
            provider = 'sqlite';
        } else {
            try {
                console.log('[Database] Attempting connection to PostgreSQL...');
                await initPostgres(cleanedUrl);
                return;
            } catch (err) {
                console.warn(`[Database] PostgreSQL connection failed: ${err.message}`);
                if (err.code === 'ENETUNREACH' || (cleanedUrl.includes('db.') && cleanedUrl.includes('.supabase.co'))) {
                    console.warn('⚠️  [Database] IPv6 Error: Render does not support direct IPv6 connections (db.*.supabase.co).');
                    console.warn('⚠️  [Database] Fix: In your Supabase Dashboard, click "Connect" -> select "Connection Pooler" (pooler.supabase.com:6543 or 5432) which supports IPv4!');
                }
                console.warn('[Database] Falling back to local SQLite so your app stays fully functional.');
                provider = 'sqlite';
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
})();

const db = {
    ready: () => readyPromise,
    get isPostgres() { return provider === 'postgres'; },
    get providerName() { return provider === 'postgres' ? 'PostgreSQL (Supabase)' : 'SQLite (Local Fallback)'; },

    // Execute query and return all matching rows as Array
    async all(sql, ...args) {
        await readyPromise;
        const params = normalizeParams(args);
        if (provider === 'postgres') {
            try {
                const pgSql = convertPlaceholders(sql);
                const res = await pgPool.query(pgSql, params);
                let rows = res.rows.map(normalizeRow);
                if (rows.length === 0 && /FROM\s+(?:users|admin_users)\b/i.test(sql) && sqliteDb) {
                    try {
                        const localRows = sqliteDb.prepare(sql).all(...params);
                        if (localRows.length > 0) rows = localRows.map(normalizeRow);
                    } catch (_) {}
                }
                return rows;
            } catch (err) {
                if (isNetworkError(err)) {
                    console.warn(`[Database] PostgreSQL connection lost (${err.message}). Switching to local SQLite.`);
                    provider = 'sqlite';
                    initSqlite();
                    return sqliteDb.prepare(sql).all(...params);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            let rows = sqliteDb.prepare(sql).all(...params);
            if (rows.length === 0 && /FROM\s+(?:users|admin_users)\b/i.test(sql) && pgPool) {
                try {
                    const pgRes = await pgPool.query(convertPlaceholders(sql), params);
                    if (pgRes.rows.length > 0) rows = pgRes.rows.map(normalizeRow);
                } catch (_) {}
            }
            return rows;
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
                let row = res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
                // Fallback for user authentication & accounts: check SQLite if not found in Postgres
                if (!row && /FROM\s+(?:users|admin_users)\b/i.test(sql) && sqliteDb) {
                    try {
                        const localRow = sqliteDb.prepare(sql).get(...params);
                        if (localRow) {
                            row = normalizeRow(localRow);
                        }
                    } catch (_) {}
                }
                return row;
            } catch (err) {
                if (isNetworkError(err)) {
                    console.warn(`[Database] PostgreSQL connection lost (${err.message}). Switching to local SQLite.`);
                    provider = 'sqlite';
                    initSqlite();
                    return sqliteDb.prepare(sql).get(...params);
                }
                throw err;
            }
        } else {
            if (!sqliteDb) initSqlite();
            let row = sqliteDb.prepare(sql).get(...params);
            // Fallback for user authentication & accounts: check Postgres if not found in SQLite
            if (!row && /FROM\s+(?:users|admin_users)\b/i.test(sql) && pgPool) {
                try {
                    const pgRes = await pgPool.query(convertPlaceholders(sql), params);
                    if (pgRes.rows[0]) {
                        row = normalizeRow(pgRes.rows[0]);
                    }
                } catch (_) {}
            }
            return row;
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
                const isIdLessTable = /INSERT\s+INTO\s+(?:system_settings|security_flags)\b/i.test(pgSql);
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
                    } catch (_) {}
                }

                return {
                    lastInsertRowid: lastId,
                    changes: res.rowCount || 0
                };
            } catch (err) {
                if (isNetworkError(err)) {
                    console.warn(`[Database] PostgreSQL connection lost (${err.message}). Switching to local SQLite.`);
                    provider = 'sqlite';
                    initSqlite();
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
                    const isIdLessTable = /INSERT\s+INTO\s+(?:system_settings|security_flags)\b/i.test(pgSql);
                    if (isInsert && !hasReturning && !isIdLessTable) {
                        pgSql += ' RETURNING id';
                    }
                    pgPool.query(pgSql, params).catch(() => {});
                } catch (_) {}
            }

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
                    console.warn(`[Database] PostgreSQL connection lost (${err.message}). Switching to local SQLite.`);
                    provider = 'sqlite';
                    initSqlite();
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
                    console.warn(`[Database] PostgreSQL connection lost (${connErr.message}). Switching to local SQLite.`);
                    provider = 'sqlite';
                    initSqlite();
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

    generateClassCodeSync
};

module.exports = db;
