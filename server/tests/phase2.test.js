const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const Module = require('node:module');

const { openSqliteDatabase } = require('../db/sqlite-adapter');
const { syncBidirectional, getCleanConnectionString, parseTsMs } = require('../db/cloudSync');
const { initLocalDb, localDbAPI } = require('../../electron/local-db.cjs');
const { getSubnetSweepIps, verifyHttpServer } = require('../../electron/lan-client.cjs');

/**
 * Creates a fake node-postgres Client backed by an in-memory SQLite database
 * whose table/column casing mirrors schema.sql in PostgreSQL.
 */
function createMockPgClient({ failTable = null } = {}) {
  const mem = openSqliteDatabase(':memory:');
  mem.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      lastlogin TEXT,
      status TEXT DEFAULT 'Active',
      avatar TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE classrooms (
      id BIGINT PRIMARY KEY,
      code TEXT,
      section TEXT,
      name TEXT,
      subject TEXT,
      instructor TEXT,
      archived INTEGER DEFAULT 0,
      instructor_email TEXT,
      description TEXT,
      settings TEXT,
      theme TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id BIGINT,
      student_id INTEGER,
      student_name TEXT,
      student_email TEXT,
      enrolled_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      UNIQUE (classroom_id, student_email)
    );
    CREATE TABLE classwork (
      id BIGINT PRIMARY KEY,
      classroom_id BIGINT,
      title TEXT,
      description TEXT,
      duedate TEXT,
      type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id BIGINT,
      student_name TEXT,
      history TEXT,
      submittedat TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE grades (
      assignment_id TEXT,
      student_id TEXT,
      grade TEXT,
      feedback TEXT,
      graded_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (assignment_id, student_id)
    );
    CREATE TABLE announcements (
      id BIGINT PRIMARY KEY,
      classroom_id BIGINT,
      title TEXT,
      details TEXT,
      author TEXT,
      posted BIGINT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE sync_deletions (
      table_name TEXT NOT NULL,
      record_key TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (table_name, record_key)
    );
  `);

  const client = {
    async query(sql, params = []) {
      const trimmed = sql.trim();
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(trimmed)) {
        mem.exec(trimmed);
        return { rows: [], rowCount: 0 };
      }
      if (failTable && new RegExp(`\\b${failTable}\\b`, 'i').test(trimmed)) {
        throw new Error(`Simulated failure on ${failTable}`);
      }

      // Convert PostgreSQL $N positional parameters to SQLite ?
      const translatedParams = [];
      const translatedSql = trimmed
        .replace(/\$(\d+)/g, (_, idx) => {
          const val = params[Number(idx) - 1];
          translatedParams.push(val === undefined ? null : val);
          return '?';
        })
        .replace(/CAST\(([^)]+) AS TEXT\)/gi, 'CAST($1 AS TEXT)');

      if (/^SELECT\b/i.test(translatedSql)) {
        const rows = mem.prepare(translatedSql).all(...translatedParams);
        return { rows, rowCount: rows.length };
      }
      const info = mem.prepare(translatedSql).run(...translatedParams);
      return { rows: [], rowCount: info.changes || 0 };
    },
    release() {
      // No-op for test client
    },
    close() {
      mem.close();
    },
    mem
  };

  return client;
}

function createLocalSyncSqlite() {
  const local = openSqliteDatabase(':memory:');
  local.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      lastLogin TEXT,
      status TEXT DEFAULT 'Active',
      avatar TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      status TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE classrooms (
      id INTEGER PRIMARY KEY,
      code TEXT,
      section TEXT,
      name TEXT,
      subject TEXT,
      instructor TEXT,
      archived INTEGER DEFAULT 0,
      instructor_email TEXT,
      description TEXT,
      settings TEXT,
      theme TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER,
      student_id INTEGER,
      student_name TEXT,
      student_email TEXT,
      enrolled_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      UNIQUE(classroom_id, student_email)
    );
    CREATE TABLE classwork (
      id INTEGER PRIMARY KEY,
      classroom_id INTEGER,
      title TEXT,
      description TEXT,
      dueDate TEXT,
      type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER,
      student_name TEXT,
      history TEXT,
      submittedAt TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE grades (
      assignment_id TEXT,
      student_id TEXT,
      grade TEXT,
      feedback TEXT,
      graded_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (assignment_id, student_id)
    );
    CREATE TABLE announcements (
      id INTEGER PRIMARY KEY,
      classroom_id INTEGER,
      title TEXT,
      details TEXT,
      author TEXT,
      posted INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE sync_deletions (
      table_name TEXT NOT NULL,
      record_key TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (table_name, record_key)
    );
  `);
  return local;
}

test('cloudSync helpers: normalize connection string & parse timestamps safely', () => {
  const direct = 'postgresql://postgres:my%pass@db.projabc123.supabase.co:5432/postgres';
  const normalized = getCleanConnectionString(direct);
  assert.ok(normalized.includes('aws-0-ap-northeast-2.pooler.supabase.com:5432'));
  assert.ok(normalized.includes('postgres.projabc123:my%25pass@'));
  assert.equal(getCleanConnectionString('postgresql://postgres:[YOUR-PASSWORD]@host/db'), null);

  assert.equal(parseTsMs(0), 0);
  assert.ok(parseTsMs('2026-11-26T12:00:00.000Z') > 0);
});

test('cloudSync: bidirectional LWW, tombstone deletion without resurrection, and zero ping-pong', async () => {
  const local = createLocalSyncSqlite();
  const pgClient = createMockPgClient();

  try {
    const oldIso = '2026-11-26T10:00:00.000Z';
    const newIso = '2026-11-26T12:00:00.000Z';

    // Seed local classroom (newer) & grade, plus cloud classroom (older) & a deleted classroom in cloud
    local.prepare(
      'INSERT INTO classrooms (id, code, section, name, subject, instructor, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(101, 'CS101A', 'BSCS-1A', 'Algorithms Updated Locally', 'CS', 'Prof Ana', newIso);

    local.prepare(
      'INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('501', 'alice@student.edu', '95', 'Great work', oldIso, newIso);

    // Tombstone locally for classroom 202 which still exists in cloud
    pgClient.mem.prepare(
      'INSERT INTO classrooms (id, code, section, name, subject, instructor, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(101, 'CS101A', 'BSCS-1A', 'Algorithms Old Cloud', 'CS', 'Prof Ana', oldIso);
    pgClient.mem.prepare(
      'INSERT INTO classrooms (id, code, section, name, subject, instructor, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(202, 'DEL202', 'BSCS-2B', 'To Be Deleted', 'CS', 'Prof Ana', oldIso);
    local.prepare(
      'INSERT INTO sync_deletions (table_name, record_key, deleted_at) VALUES (?, ?, ?)'
    ).run('classrooms', '202', newIso);

    const firstSync = await syncBidirectional({ sqliteDb: local, pgClient });
    assert.equal(firstSync.status, 'success');
    assert.deepEqual(firstSync.errors, []);

    // Verify classroom 202 was removed from cloud & NOT resurrected into local
    assert.equal(pgClient.mem.prepare('SELECT id FROM classrooms WHERE id = 202').get(), undefined);
    assert.equal(local.prepare('SELECT id FROM classrooms WHERE id = 202').get(), undefined);

    // Verify LWW pushed newer local classroom & grade to cloud
    const cloudCls = pgClient.mem.prepare('SELECT name FROM classrooms WHERE id = 101').get();
    assert.equal(cloudCls.name, 'Algorithms Updated Locally');
    const cloudGrade = pgClient.mem.prepare('SELECT grade, feedback FROM grades WHERE assignment_id = ?').get('501');
    assert.equal(cloudGrade.grade, '95');

    // Second sync immediately after MUST have 0 pushes & 0 pulls (no grades/timestamp ping-pong loop!)
    const secondSync = await syncBidirectional({ sqliteDb: local, pgClient });
    assert.equal(secondSync.status, 'success');
    assert.equal(secondSync.pushed, 0);
    assert.equal(secondSync.pulled, 0);
  } finally {
    local.close();
    pgClient.close();
  }
});

test('cloudSync: user ID shift cascades enrollments.student_id and reports partial failures', async () => {
  const local = createLocalSyncSqlite();
  const pgClient = createMockPgClient({ failTable: 'announcements' });

  try {
    const t1 = '2026-11-26T10:00:00.000Z';
    const t2 = '2026-11-26T11:00:00.000Z';

    local.prepare('INSERT INTO classrooms (id, code, section, name, updated_at) VALUES (?, ?, ?, ?, ?)').run(301, 'SEC3', '3A', 'Systems', t1);
    local.prepare('INSERT INTO users (id, name, email, password, role, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'Bob', 'bob@edu.ph', 'hash1', 'Student', 'Active', t1);
    local.prepare('INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(301, 1, 'Bob', 'bob@edu.ph', t1, t1);

    // Cloud has newer user record with a different numeric ID (id=42)
    pgClient.mem.prepare('INSERT INTO classrooms (id, code, section, name, updated_at) VALUES (?, ?, ?, ?, ?)').run(301, 'SEC3', '3A', 'Systems', t1);
    pgClient.mem.prepare('INSERT INTO users (id, name, email, password, role, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(42, 'Bob Updated', 'bob@edu.ph', 'hash2', 'Student', 'Active', t2);

    const res = await syncBidirectional({ sqliteDb: local, pgClient });
    assert.equal(res.status, 'partial');
    assert.ok(res.errors.some(e => e.startsWith('announcements:')));

    const updatedUser = local.prepare('SELECT id, name FROM users WHERE email = ?').get('bob@edu.ph');
    assert.equal(updatedUser.id, 42);
    assert.equal(updatedUser.name, 'Bob Updated');

    const cascadedEnrollment = local.prepare('SELECT student_id FROM enrollments WHERE classroom_id = 301 AND student_email = ?').get('bob@edu.ph');
    assert.equal(cascadedEnrollment.student_id, 42);
  } finally {
    local.close();
    pgClient.close();
  }
});

test('local-db.cjs: roundtrips drafts, setLocal string/null preservation, sync queue dedup, and close()', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_localdb_'));
  try {
    const info = initLocalDb(tmpDir);
    assert.ok(['sqlite', 'json-fallback'].includes(info.type));

    localDbAPI.saveDraft('a1', 's1', 'Console.WriteLine("Hi");', [{ time: 1, code: 'x' }]);
    const draft = localDbAPI.getDraft('a1', 's1');
    assert.equal(draft.code, 'Console.WriteLine("Hi");');
    assert.equal(draft.history.length, 1);

    localDbAPI.setLocal('numeric_str', '123');
    localDbAPI.setLocal('cleared_key', null);
    assert.strictEqual(localDbAPI.getLocal('numeric_str'), '123');
    assert.strictEqual(localDbAPI.getLocal('cleared_key'), null);

    const q1 = localDbAPI.addToSyncQueue('save_grade', '/grades/1', 'POST', { grade: 100 });
    const q2 = localDbAPI.addToSyncQueue('save_grade', '/grades/1', 'POST', { grade: 100 });
    assert.equal(q2.id, q1.id);
    assert.equal(localDbAPI.getSyncQueue().length, 1);
  } finally {
    localDbAPI.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('lan-client.cjs: true subnet sweep bounds and strict /health app verification', async () => {
  const ips24 = getSubnetSweepIps('192.168.10.5', '255.255.255.0', new Set(['192.168.10.5']), [100, 1]);
  assert.equal(ips24.includes('192.168.10.5'), false);
  assert.equal(ips24.includes('192.168.10.100'), false);
  assert.equal(ips24.includes('192.168.10.254'), true);

  // /23 subnet spans 510 hosts
  const ips23 = getSubnetSweepIps('10.0.0.5', '255.255.254.0', new Set(['10.0.0.5']), []);
  assert.equal(ips23.length, 509);

  // Fake HTTP server without Verity app tag should be rejected by verifyHttpServer
  const fakeSrv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'other-service' }));
  });
  await new Promise(resolve => fakeSrv.listen(0, '127.0.0.1', resolve));
  const port = fakeSrv.address().port;
  try {
    const okFake = await verifyHttpServer(`http://127.0.0.1:${port}`, 1000, true);
    assert.equal(okFake, false);
  } finally {
    await new Promise(resolve => fakeSrv.close(resolve));
  }
});

test('updater.cjs: blocks HTTPS->HTTP downgrade and invalid non-PE binaries, verifies SHA-256', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_updater_'));
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          isPackaged: false,
          getPath: () => tmpDir,
          getVersion: () => '1.0.0',
          exit: () => {}
        },
        ipcMain: { handle: () => {} }
      };
    }
    return origLoad.apply(this, arguments);
  };

  let downloadUpdateFile;
  try {
    const updaterPath = require.resolve('../../electron/updater.cjs');
    delete require.cache[updaterPath];
    ({ downloadUpdateFile } = require('../../electron/updater.cjs'));
  } finally {
    Module._load = origLoad;
  }

  // Build valid minimal MZ binary >= 1024 bytes
  const validBin = Buffer.alloc(2048, 0x90);
  validBin[0] = 0x4d;
  validBin[1] = 0x5a;
  const expectedHash = crypto.createHash('sha256').update(validBin).digest('hex');

  const srv = http.createServer((req, res) => {
    if (req.url === '/bad-exe') {
      const bad = Buffer.alloc(1500, 0x41);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bad.length) });
      res.end(bad);
      return;
    }
    if (req.url === '/good-exe') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(validBin.length) });
      res.end(validBin);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;

  try {
    await assert.rejects(
      () => downloadUpdateFile(`http://127.0.0.1:${port}/bad-exe`),
      /not a valid Windows executable/i
    );
    await assert.rejects(
      () => downloadUpdateFile(`http://127.0.0.1:${port}/good-exe`, null, '0'.repeat(64)),
      /checksum verification failed/i
    );
    const savedPath = await downloadUpdateFile(`http://127.0.0.1:${port}/good-exe`, null, expectedHash);
    assert.equal(fs.existsSync(savedPath), true);
  } finally {
    await new Promise(resolve => srv.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
