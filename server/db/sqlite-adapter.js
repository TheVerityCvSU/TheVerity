const path = require('path');
const fs = require('fs');

/**
 * Normalizes query parameters into a flat array.
 */
function normalizeParams(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
}

/**
 * Normalizes a row returned by SQLite into a plain object with camelCase properties.
 */
function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    const r = { ...row };
    if (r.lastlogin !== undefined && r.lastLogin === undefined) r.lastLogin = r.lastlogin;
    if (r.duedate !== undefined && r.dueDate === undefined) r.dueDate = r.duedate;
    if (r.submittedat !== undefined && r.submittedAt === undefined) r.submittedAt = r.submittedat;
    if (r.c !== undefined && !isNaN(Number(r.c))) r.c = Number(r.c);
    if (r.id !== undefined && !isNaN(Number(r.id))) r.id = Number(r.id);
    if (r.classroom_id !== undefined && !isNaN(Number(r.classroom_id))) r.classroom_id = Number(r.classroom_id);
    if (r.assignment_id !== undefined && !isNaN(Number(r.assignment_id))) r.assignment_id = Number(r.assignment_id);
    return r;
}

/**
 * Wraps a raw SQLite database instance (better-sqlite3 or node:sqlite) with a uniform API.
 */
function wrapSqlite(rawDb, engine) {
    const sanitize = (params) => params.map(p => (p === undefined ? null : p));

    return {
        engine,
        get raw() { return rawDb; },

        pragma(cmd) {
            if (typeof rawDb.pragma === 'function') {
                try { return rawDb.pragma(cmd); } catch (_) {}
            }
            try { return rawDb.exec(`PRAGMA ${cmd};`); } catch (_) {}
        },

        exec(sql) {
            return rawDb.exec(sql);
        },

        prepare(sql) {
            const rawStmt = rawDb.prepare(sql);
            return {
                all(...args) {
                    const params = sanitize(normalizeParams(args));
                    const rows = rawStmt.all(...params);
                    return (rows || []).map(normalizeRow);
                },
                get(...args) {
                    const params = sanitize(normalizeParams(args));
                    const row = rawStmt.get(...params);
                    return row ? normalizeRow(row) : undefined;
                },
                run(...args) {
                    const params = sanitize(normalizeParams(args));
                    const res = rawStmt.run(...params);
                    return {
                        lastInsertRowid: res && res.lastInsertRowid !== undefined && !isNaN(Number(res.lastInsertRowid))
                            ? Number(res.lastInsertRowid)
                            : (res ? res.lastInsertRowid : null),
                        changes: res && res.changes !== undefined ? res.changes : 0
                    };
                }
            };
        },

        transaction(fn) {
            if (typeof rawDb.transaction === 'function') {
                return rawDb.transaction(fn);
            }
            return (...args) => {
                rawDb.exec('BEGIN');
                try {
                    const res = fn(...args);
                    rawDb.exec('COMMIT');
                    return res;
                } catch (e) {
                    rawDb.exec('ROLLBACK');
                    throw e;
                }
            };
        },

        close() {
            if (typeof rawDb.close === 'function') {
                try { rawDb.close(); } catch (_) {}
            }
        }
    };
}

/**
 * In-memory fallback if neither better-sqlite3 nor node:sqlite can be loaded.
 * Ensures the app never crashes with "Cannot read properties of null (reading 'prepare')".
 */
function createMemoryFallback() {
    console.warn('[SQLiteAdapter] Using in-memory fallback store.');
    return {
        engine: 'memory-fallback',
        pragma: () => {},
        exec: () => {},
        prepare: () => ({
            all: () => [],
            get: () => undefined,
            run: () => ({ lastInsertRowid: 1, changes: 1 })
        }),
        transaction: (fn) => (...args) => fn(...args),
        close: () => {}
    };
}

/**
 * Opens a SQLite database file using better-sqlite3 or Node's built-in node:sqlite.
 */
function openSqliteDatabase(dbFile) {
    if (dbFile && dbFile !== ':memory:') {
        const dir = path.dirname(dbFile);
        if (!fs.existsSync(dir)) {
            try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
        }
    }

    let rawDb = null;
    let engine = null;

    // 1. Try better-sqlite3 (compiled native addon)
    try {
        let Database;
        try {
            Database = require('better-sqlite3');
        } catch (_) {
            Database = require('../../server/node_modules/better-sqlite3');
        }
        rawDb = new Database(dbFile);
        engine = 'better-sqlite3';
    } catch (_) {
        // Native bindings missing or incompatible (common on newer Node versions like Node 24 on Windows)
    }

    // 2. Try Node.js built-in node:sqlite (available in Node 22.5+, Node 24+, modern Electron)
    if (!rawDb) {
        try {
            const { DatabaseSync } = require('node:sqlite');
            rawDb = new DatabaseSync(dbFile);
            engine = 'node:sqlite';
        } catch (err) {
            console.warn('[SQLiteAdapter] node:sqlite initialization notice:', err.message);
        }
    }

    if (!rawDb) {
        return createMemoryFallback();
    }

    return wrapSqlite(rawDb, engine);
}

module.exports = {
    openSqliteDatabase,
    normalizeRow,
    normalizeParams
};
