const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_p3_test_'));
process.env.VERITY_SKIP_DOTENV = '1';
process.env.VERITY_SKIP_SEED = '1';
process.env.DATABASE_URL = '';
process.env.DATA_DIR = tempDataDir;
process.env.IS_LAN_HOST = 'false';
process.env.JWT_SECRET = 'phase3_test_secret_at_least_32_chars_long_987';
process.env.VERITY_BOOTSTRAP_ADMIN_EMAIL = 'admin@p3test.local';
process.env.VERITY_BOOTSTRAP_ADMIN_PASSWORD = 'Admin@2026!Secure';

const {
  todayKey,
  resolveJwtSecret,
  isAllowedCorsOrigin,
  getValidLanIps,
  extractClientIp,
  isHostServerInstance,
} = require('../utils/serverHelpers');
const { createAuthMiddleware } = require('../middleware/authMiddleware');
const { createSystemSettingsService, DEFAULT_PASSWORD_POLICIES } = require('../services/systemSettingsService');
const { parseClassroomSettings, parseArchivedBool, DEFAULT_CLASSROOM_SETTINGS } = require('../services/classroomAccess');
const { parseCompilerDiagnostics, createSandboxedRunEnv } = require('../services/compilerService');
const { registerUploadRoutes } = require('../routes/uploads');
const { start, stop, app } = require('../server');

test.after(() => {
  try {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  } catch (_) {}
});

test('serverHelpers: date key, persistent JWT key, CORS policy, IP normalization, host detection', () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);

  const prevSecret = process.env.JWT_SECRET;
  const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_jwt_dir_'));
  try {
    delete process.env.JWT_SECRET;
    const first = resolveJwtSecret(keyDir);
    assert.equal(first.isShared, false);
    assert.ok(first.secret.length >= 64);

    const second = resolveJwtSecret(keyDir);
    assert.equal(second.secret, first.secret);

    process.env.JWT_SECRET = 'explicit_env_secret_value_for_testing';
    const fromEnv = resolveJwtSecret(keyDir);
    assert.equal(fromEnv.isShared, true);
    assert.equal(fromEnv.secret, 'explicit_env_secret_value_for_testing');
  } finally {
    process.env.JWT_SECRET = prevSecret;
    fs.rmSync(keyDir, { recursive: true, force: true });
  }

  assert.equal(isAllowedCorsOrigin(undefined), true);
  assert.equal(isAllowedCorsOrigin('file:///C:/app/index.html'), true);
  assert.equal(isAllowedCorsOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedCorsOrigin('http://192.168.10.25:3001'), true);
  assert.equal(isAllowedCorsOrigin('https://verity-preview.vercel.app'), true);
  assert.equal(isAllowedCorsOrigin('https://evil-student.vercel.app'), false);
  assert.equal(isAllowedCorsOrigin('https://evil.example.com'), false);
  assert.equal(isAllowedCorsOrigin('not a url'), false);

  assert.equal(Array.isArray(getValidLanIps()), true);
  assert.equal(extractClientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9');
  assert.equal(extractClientIp({ ip: '::ffff:192.168.1.44' }), '192.168.1.44');

  const flagDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_host_dir_'));
  const prevLanHost = process.env.IS_LAN_HOST;
  try {
    fs.writeFileSync(path.join(flagDir, 'host.flag'), '1');
    process.env.IS_LAN_HOST = 'false';
    assert.equal(isHostServerInstance({ dataDir: flagDir, serverDir: flagDir }), false);

    delete process.env.IS_LAN_HOST;
    assert.equal(isHostServerInstance({ dataDir: flagDir, serverDir: flagDir }), true);
  } finally {
    process.env.IS_LAN_HOST = prevLanHost;
    fs.rmSync(flagDir, { recursive: true, force: true });
  }
});

test('authMiddleware: JWT verification, RBAC roles, and loopback check', () => {
  const secret = 'auth_middleware_test_secret_32_chars';
  const mw = createAuthMiddleware({ JWT_SECRET: secret, IS_RENDER_CLOUD: false });

  assert.equal(mw.isLoopbackAddress('127.0.0.1'), true);
  assert.equal(mw.isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(mw.isLoopbackAddress('::1'), true);
  assert.equal(mw.isLoopbackAddress('192.168.1.50'), false);

  const validToken = jwt.sign({ id: 7, email: 'admin@verity.local', role: 'Admin' }, secret, { expiresIn: '5m' });
  assert.equal(mw.verifySessionToken(validToken)?.role, 'Admin');
  assert.equal(mw.verifySessionToken('invalid.jwt.token'), null);

  // Missing token -> 401
  let statusCode = null;
  let body = null;
  const mockRes = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  mw.authenticateToken({ headers: {}, query: {} }, mockRes, () => {
    throw new Error('Should not call next without token');
  });
  assert.equal(statusCode, 401);
  assert.match(body.message, /No token/i);

  // Valid token -> populates req.user
  const reqAuth = { headers: { authorization: `Bearer ${validToken}` }, query: {} };
  let calledNext = false;
  mw.authenticateToken(reqAuth, mockRes, () => { calledNext = true; });
  assert.equal(calledNext, true);
  assert.equal(reqAuth.user.email, 'admin@verity.local');

  // Role guard -> blocks Student, allows Admin
  let rbacStatus = null;
  mw.requireRole('Admin')({ user: { role: 'Student' } }, {
    status(c) { rbacStatus = c; return this; },
    json() { return this; },
  }, () => { throw new Error('Should not pass Student'); });
  assert.equal(rbacStatus, 403);

  let adminPassed = false;
  mw.requireRole('Admin')({ user: { role: 'Admin' } }, mockRes, () => { adminPassed = true; });
  assert.equal(adminPassed, true);
});

test('classroomAccess & systemSettingsService: settings normalization, policies, kiosk config, maintenance mode', async () => {
  assert.deepEqual(parseClassroomSettings(null), DEFAULT_CLASSROOM_SETTINGS);
  assert.deepEqual(parseClassroomSettings('{bad json'), DEFAULT_CLASSROOM_SETTINGS);
  assert.deepEqual(
    parseClassroomSettings(JSON.stringify({ inviteCodes: 'Turned off', showDeleted: 1 })),
    {
      inviteCodes: 'Turned off',
      stream: DEFAULT_CLASSROOM_SETTINGS.stream,
      classworkStream: DEFAULT_CLASSROOM_SETTINGS.classworkStream,
      showDeleted: true,
    }
  );
  assert.equal(parseArchivedBool(true), true);
  assert.equal(parseArchivedBool(1), true);
  assert.equal(parseArchivedBool('true'), true);
  assert.equal(parseArchivedBool(0), false);

  const settingsStore = new Map();
  const mockDb = {
    async get(sql) {
      if (sql.includes("'global_config'")) return settingsStore.get('global_config') || null;
      if (sql.includes("'security'")) return settingsStore.get('security') || null;
      return null;
    },
    async run() {},
  };

  const svc = createSystemSettingsService({ db: mockDb, io: null, activeStudents: new Map() });
  assert.deepEqual(await svc.getPasswordPolicies(), DEFAULT_PASSWORD_POLICIES);
  assert.match(await svc.validatePassword('short'), /8 characters/);
  assert.match(await svc.validatePassword('NoNumbers!'), /number/);
  assert.match(await svc.validatePassword('NoSpecial123'), /special character/);
  assert.equal(await svc.validatePassword('ValidPass123!'), null);

  settingsStore.set('global_config', {
    value: JSON.stringify({
      general: { maintenanceMode: true, offlineMessage: 'Scheduled upgrade' },
      security: { violationThreshold: 5, passwordPolicies: { minLength8: true, numbers: false, specialChars: false } },
    }),
  });

  const maint = await svc.getMaintenanceStatus();
  assert.deepEqual(maint, { enabled: true, message: 'Scheduled upgrade' });

  const kiosk = await svc.getKioskSettings();
  assert.equal(kiosk.violationThreshold, 5);
  assert.equal(kiosk.blockCopyPaste, true);
  assert.equal(await svc.validatePassword('onlyletters'), null);
});

test('compilerService: diagnostic parser and sandboxed run environment secret stripping', () => {
  const sampleOut = [
    'C:\\Temp\\job_1\\Program.cs(12,5): error CS0103: The name \'foo\' does not exist in the current context [C:\\Temp\\job_1\\App.csproj]',
    'Program.cs(4,1,4,10): warning CS0219: The variable \'x\' is assigned but its value is never used',
  ].join('\n');

  const diags = parseCompilerDiagnostics(sampleOut);
  assert.equal(diags.length, 2);
  assert.deepEqual(diags[0], {
    file: 'Program.cs',
    severity: 'error',
    code: 'CS0103',
    message: "CS0103: The name 'foo' does not exist in the current context",
    startLineNumber: 12,
    startColumn: 5,
    endLineNumber: 12,
    endColumn: null,
  });
  assert.equal(diags[1].severity, 'warning');
  assert.equal(diags[1].code, 'CS0219');

  const prevDbUrl = process.env.DATABASE_URL;
  const prevR2 = process.env.R2_SECRET_ACCESS_KEY;
  process.env.DATABASE_URL = 'postgres://user:secret@host/db';
  process.env.R2_SECRET_ACCESS_KEY = 'super-secret-r2-key';
  try {
    const sandboxDir = path.join(tempDataDir, 'sandbox_run');
    const env = createSandboxedRunEnv(sandboxDir);
    assert.equal(env.DOTNET_GCHeapHardLimit, '0x10000000');
    assert.equal(env.TEMP, sandboxDir);
    assert.equal(env.TMP, sandboxDir);
    assert.equal('JWT_SECRET' in env, false);
    assert.equal('DATABASE_URL' in env, false);
    assert.equal('R2_SECRET_ACCESS_KEY' in env, false);
  } finally {
    process.env.DATABASE_URL = prevDbUrl;
    process.env.R2_SECRET_ACCESS_KEY = prevR2;
  }
});

test('routes/uploads: rejects disallowed extensions and traversal filenames', async () => {
  const uploadTestApp = express();
  uploadTestApp.use(express.json());
  const mockDb = { async get() { return null; }, async run() {} };
  registerUploadRoutes(uploadTestApp, {
    db: mockDb,
    DATA_DIR: tempDataDir,
    IS_RENDER_CLOUD: false,
    r2Storage: { isR2Configured: () => false },
    authenticateToken: (_req, _res, next) => next(),
    checkIsHost: () => false,
  });

  const srv = http.createServer(uploadTestApp);
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Disallowed extension via base64 endpoint
    const badRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'payload.exe', dataUrl: 'data:application/octet-stream;base64,TVqQ' }),
    });
    assert.equal(badRes.status, 400);

    // Unsafe dot-prefixed / traversal basename rejected by GET /uploads/:filename
    const travRes = await fetch(`${baseUrl}/uploads/.hidden-secret`);
    assert.equal(travRes.status, 404);

    // Valid txt base64 upload succeeds and is readable back
    const okRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'notes.txt',
        dataUrl: `data:text/plain;base64,${Buffer.from('verity upload ok').toString('base64')}`,
      }),
    });
    assert.equal(okRes.status, 201);
    const okJson = await okRes.json();
    assert.match(okJson.path, /^\/uploads\/.*\.txt$/);

    const fetchUploaded = await fetch(`${baseUrl}${okJson.path}`);
    assert.equal(fetchUploaded.status, 200);
    assert.equal(await fetchUploaded.text(), 'verity upload ok');
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});

test('modular server.js: exports app/start/stop and serves system routes cleanly', async () => {
  assert.equal(typeof start, 'function');
  assert.equal(typeof stop, 'function');
  assert.equal(typeof app, 'function');

  const boundPort = await start(0);
  const baseUrl = `http://127.0.0.1:${boundPort}`;
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'operational');
    assert.equal(health.app, 'the-verity');

    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    assert.match(await robotsRes.text(), /Disallow: \//);

    const maintRes = await fetch(`${baseUrl}/maintenance-status`);
    assert.equal(maintRes.status, 200);
    assert.equal((await maintRes.json()).enabled, false);

    const kioskRes = await fetch(`${baseUrl}/kiosk-settings`);
    assert.equal(kioskRes.status, 200);
    const kiosk = await kioskRes.json();
    assert.equal(typeof kiosk.settings?.violationThreshold, 'number');

    const activeRes = await fetch(`${baseUrl}/active-activities`);
    assert.equal(activeRes.status, 200);
    assert.deepEqual(await activeRes.json(), { counts: {}, classroomCounts: {} });

    const dotnetRes = await fetch(`${baseUrl}/api/system/dotnet-status`);
    assert.equal(dotnetRes.status, 200);
    const dotnetStatus = await dotnetRes.json();
    assert.equal(typeof dotnetStatus.installed, 'boolean');
  } finally {
    await stop();
  }
});

test('submission-counts & classroom-students: deduplicate duplicate submissions and preserve same-name distinct students', async () => {
  const db = require('../db/index.js');
  const boundPort = await start(0);
  const baseUrl = `http://127.0.0.1:${boundPort}`;
  try {
    const teacherToken = jwt.sign(
      { id: 9001, name: 'Test Teacher', email: 'teacher@p3test.local', role: 'Teacher' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      9001, 'Test Teacher', 'teacher@p3test.local', 'x', 'Teacher'
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      9002, 'Same Name', 's1@p3test.local', 'x', 'Student'
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      9003, 'Same Name', 's2@p3test.local', 'x', 'Student'
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      9004, 'Helper Teacher', 'helper@p3test.local', 'x', 'Teacher'
    );

    const cid = 990101;
    const aid = 990202;
    await db.run(
      'INSERT OR REPLACE INTO classrooms (id, code, name, instructor, instructor_email) VALUES (?, ?, ?, ?, ?)',
      cid, 'p3c101', 'Test Quantum Class', 'Test Teacher', 'teacher@p3test.local'
    );
    await db.run(
      'INSERT OR REPLACE INTO classwork (id, classroom_id, title, description, type) VALUES (?, ?, ?, ?, ?)',
      aid, cid, 'Activity 5: The Quantum Vault Infiltration', '{}', 'Activity'
    );
    await db.run(
      'INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (?, ?, ?, ?)',
      cid, 9002, 'Same Name', 's1@p3test.local'
    );
    await db.run(
      'INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (?, ?, ?, ?)',
      cid, 9002, 'Same Name', 'S1@P3TEST.LOCAL'
    );
    await db.run(
      'INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (?, ?, ?, ?)',
      cid, 9003, 'Same Name', 's2@p3test.local'
    );

    // Duplicate submission rows for the same student + a teacher test submission
    await db.run(
      'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
      aid, 'Same Name', '[]', '2026-11-20T10:00:00.000Z'
    );
    await db.run(
      'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
      aid, '  same name ', '[]', '2026-11-20T10:00:01.000Z'
    );
    await db.run(
      'INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (?, ?, ?, ?)',
      aid, 'Helper Teacher', '[]', '2026-11-20T10:01:00.000Z'
    );

    const headers = { Authorization: `Bearer ${teacherToken}` };
    const countsRes = await fetch(`${baseUrl}/submission-counts?classroomId=${cid}`, { headers });
    assert.equal(countsRes.status, 200);
    const countsData = await countsRes.json();
    assert.equal(countsData.counts[String(aid)], 2);
    assert.equal(countsData.studentCount, 2);

    const rosterRes = await fetch(`${baseUrl}/classroom-students/${cid}`, { headers });
    assert.equal(rosterRes.status, 200);
    const rosterData = await rosterRes.json();
    assert.equal(rosterData.students.length, 2);
    assert.deepEqual(
      rosterData.students.map((s) => s.email).sort(),
      ['s1@p3test.local', 's2@p3test.local']
    );
  } finally {
    await stop();
  }
});

test('Socket.IO hardening: blocks unauthenticated student/proctor events and accepts valid JWT & CLOUD_RELAY_SECRET', async () => {
  const { io: ioc } = require('socket.io-client');
  const db = require('../db/index.js');
  const prevRelaySecret = process.env.CLOUD_RELAY_SECRET;
  process.env.CLOUD_RELAY_SECRET = 'relay_test_shared_secret_32_chars_min';
  const boundPort = await start(0);
  const baseUrl = `http://127.0.0.1:${boundPort}`;

  try {
    const aid = 990303;
    const cid = 990301;
    await db.run(
      'INSERT OR REPLACE INTO classrooms (id, code, name, instructor, instructor_email) VALUES (?, ?, ?, ?, ?)',
      cid, 'p3sec1', 'Security Test Class', 'Test Teacher', 'teacher@p3test.local'
    );
    await db.run(
      'INSERT OR REPLACE INTO classwork (id, classroom_id, title, description, type) VALUES (?, ?, ?, ?, ?)',
      aid, cid, 'Hardened Lab', '{}', 'Activity'
    );

    // 1. Unauthenticated socket cannot submit exams or inject proctor alerts
    await new Promise((resolve, reject) => {
      const anonSock = ioc(baseUrl, { transports: ['websocket'] });
      const timer = setTimeout(() => {
        anonSock.disconnect();
        reject(new Error('Anon socket rejection timeout'));
      }, 5000);

      let sawError = false;
      anonSock.on('error', (err) => {
        if (err?.message?.includes('Authentication required')) {
          sawError = true;
        }
      });

      anonSock.on('connect', () => {
        anonSock.emit('proctor_alert', {
          studentId: 'victim_id',
          name: 'Victim Student',
          action: 'Spoofed Alert',
          classroomId: cid,
          assignmentId: aid,
        });
        anonSock.emit('submit_exam', {
          studentName: 'Victim Student',
          studentId: 'victim_id',
          assignmentId: aid,
          classroomId: cid,
          codeHistory: [{ time: 1, code: '// spoofed' }],
        });
        setTimeout(() => {
          clearTimeout(timer);
          anonSock.disconnect();
          if (sawError) resolve();
          else reject(new Error('Expected Authentication required error for unauthenticated submit_exam'));
        }, 350);
      });
    });

    const spoofedSub = await db.get(
      'SELECT * FROM submissions WHERE assignment_id = ? AND LOWER(student_name) = ?',
      aid, 'victim student'
    );
    assert.equal(spoofedSub, undefined);

    const spoofedAudit = await db.get(
      'SELECT * FROM audit_logs WHERE type = ? OR "desc" LIKE ?',
      'Spoofed Alert', '%Spoofed Alert%'
    );
    assert.equal(spoofedAudit, undefined);

    // 2. Authenticated student cannot spoof another student's identity on submit_exam
    const studentToken = jwt.sign(
      { id: 9002, name: 'Same Name', email: 's1@p3test.local', role: 'Student' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    await new Promise((resolve, reject) => {
      const stuSock = ioc(baseUrl, { transports: ['websocket'], auth: { token: studentToken } });
      const timer = setTimeout(() => {
        stuSock.disconnect();
        reject(new Error('Student socket submit timeout'));
      }, 5000);
      stuSock.on('connect', () => {
        stuSock.emit('submit_exam', {
          studentName: 'Victim Student',
          studentId: '999999',
          assignmentId: aid,
          classroomId: cid,
          codeHistory: [{ time: 2, code: '// real student' }],
        });
        setTimeout(() => {
          clearTimeout(timer);
          stuSock.disconnect();
          resolve();
        }, 350);
      });
    });

    const victimSubAfterStu = await db.get(
      'SELECT * FROM submissions WHERE assignment_id = ? AND LOWER(student_name) = ?',
      aid, 'victim student'
    );
    assert.equal(victimSubAfterStu, undefined);

    const ownSub = await db.get(
      'SELECT * FROM submissions WHERE assignment_id = ? AND LOWER(student_name) = ?',
      aid, 'same name'
    );
    assert.ok(ownSub);

    // 3. Authenticated CLOUD_RELAY_SECRET socket is permitted to relay submissions
    await new Promise((resolve, reject) => {
      const relaySock = ioc(baseUrl, {
        transports: ['websocket'],
        auth: { relaySecret: process.env.CLOUD_RELAY_SECRET },
      });
      const timer = setTimeout(() => {
        relaySock.disconnect();
        reject(new Error('Relay socket timeout'));
      }, 5000);
      relaySock.on('error', (err) => {
        clearTimeout(timer);
        relaySock.disconnect();
        reject(new Error(`Unexpected relay error: ${err?.message}`));
      });
      relaySock.on('connect', () => {
        relaySock.emit('submit_exam', {
          studentName: 'Relayed Student',
          studentId: 'relayed_1',
          assignmentId: aid,
          classroomId: cid,
          codeHistory: [{ time: 3, code: '// relayed' }],
        });
        setTimeout(() => {
          clearTimeout(timer);
          relaySock.disconnect();
          resolve();
        }, 350);
      });
    });

    const relayedSub = await db.get(
      'SELECT * FROM submissions WHERE assignment_id = ? AND LOWER(student_name) = ?',
      aid, 'relayed student'
    );
    assert.ok(relayedSub);
  } finally {
    if (prevRelaySecret === undefined) delete process.env.CLOUD_RELAY_SECRET;
    else process.env.CLOUD_RELAY_SECRET = prevRelaySecret;
    await stop();
  }
});

test('security hardening: blocks google_sso_user takeover, wildcard login, numeric classroom join, suspended JWT, and C# scanner bypasses', async () => {
  const { scanCSharpCode } = require('../csharpSecurityScanner');
  assert.equal(scanCSharpCode('System.IO.Fil\\u0065.ReadAllText("x");').isSafe, false);
  assert.equal(scanCSharpCode('var t = typeof(object).Assembly.GetType("System.IO.File");').isSafe, false);
  assert.equal(scanCSharpCode('var m = obj.GetType().GetMethod("Foo");').isSafe, false);
  assert.equal(scanCSharpCode('var p = "file:///C:/Windows/System32";').isSafe, false);
  assert.equal(scanCSharpCode('using System;\nclass P { static void Main() { Console.WriteLine("ok"); } }').isSafe, true);

  const db = require('../db/index.js');
  const boundPort = await start(0);
  const baseUrl = `http://127.0.0.1:${boundPort}`;
  try {
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      9101, 'Google Teacher', 'gteacher@cvsu.edu.ph', 'google_sso_user', 'Teacher', 'Active'
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      9102, 'Suspended Student', 'susp@cvsu.edu.ph', 'x', 'Student', 'Suspended'
    );
    await db.run(
      'INSERT OR REPLACE INTO users (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      9103, 'Active Student', 'active@cvsu.edu.ph', 'x', 'Student', 'Active'
    );
    await db.run(
      'INSERT OR REPLACE INTO classrooms (id, code, section, name, instructor, instructor_email) VALUES (?, ?, ?, ?, ?, ?)',
      910999, 'exact99', 'SEC-99', 'Secret Class', 'Google Teacher', 'gteacher@cvsu.edu.ph'
    );

    // 1. Cannot hijack google_sso_user via /login
    const ssoTakeover = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gteacher@cvsu.edu.ph', password: 'AttackerPass123!' }),
    });
    assert.equal(ssoTakeover.status, 401);
    const afterSsoRow = await db.get('SELECT password FROM users WHERE id = 9101');
    assert.equal(afterSsoRow.password, 'google_sso_user');

    // 2. Wildcard '%' login does not match arbitrary users
    const wildcardLogin = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '%', password: 'x' }),
    });
    assert.equal(wildcardLogin.status, 401);

    // 3. Suspended user JWT is rejected by authenticateToken
    const suspendedToken = jwt.sign(
      { id: 9102, email: 'susp@cvsu.edu.ph', role: 'Student', name: 'Suspended Student' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    const suspRes = await fetch(`${baseUrl}/classrooms`, {
      headers: { Authorization: `Bearer ${suspendedToken}` },
    });
    assert.equal(suspRes.status, 403);

    // 4. Student cannot join classroom by numeric ID or section name; exact code works
    const studentToken = jwt.sign(
      { id: 9103, email: 'active@cvsu.edu.ph', role: 'Student', name: 'Active Student' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    const joinById = await fetch(`${baseUrl}/classrooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ code: '910999' }),
    });
    assert.equal(joinById.status, 404);

    const joinBySection = await fetch(`${baseUrl}/classrooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ code: 'SEC-99' }),
    });
    assert.equal(joinBySection.status, 404);

    const joinByCode = await fetch(`${baseUrl}/classrooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ code: 'EXACT99' }),
    });
    assert.equal(joinByCode.status, 200);

    // 5. Additional C# scanner bypasses (\x hex escapes, XmlDocument/XPathDocument/ReadXml)
    assert.equal(scanCSharpCode('var doc = new System.Xml.XmlDocument(); doc.Load("x");').isSafe, false);
    assert.equal(scanCSharpCode('var xp = new System.Xml.XPath.XPathDocument("x");').isSafe, false);
    assert.equal(scanCSharpCode('ds.ReadXml("x");').isSafe, false);
    assert.equal(scanCSharpCode('var p = "\\x2e\\x2e\\x2fsecret";').isSafe, false);

    // 6. PUT /users/profile blocks renaming to an existing user's display name (IDOR prevention)
    const renameCollision = await fetch(`${baseUrl}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: 'Google Teacher' }),
    });
    assert.equal(renameCollision.status, 409);

    // 7. POST /login rate-limits repeated failed attempts
    for (let i = 0; i < 8; i++) {
      const failRes = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'active@cvsu.edu.ph', password: 'WrongPassword!' }),
      });
      assert.equal(failRes.status, 401);
    }
    const rateLimitedRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'active@cvsu.edu.ph', password: 'WrongPassword!' }),
    });
    assert.equal(rateLimitedRes.status, 429);

    // 8. Socket.IO rejects suspended JWT & does not leak admin_security_alert to anonymous sockets
    const { io: ioc } = require('socket.io-client');
    await new Promise((resolve, reject) => {
      const anonSock = ioc(baseUrl, { transports: ['websocket'] });
      const suspSock = ioc(baseUrl, { transports: ['websocket'], auth: { token: suspendedToken } });
      let sawAdminLeak = false;
      let sawSuspCompileOk = false;
      const timer = setTimeout(() => {
        anonSock.disconnect();
        suspSock.disconnect();
        if (sawAdminLeak) return reject(new Error('Anonymous socket received admin_security_alert'));
        if (sawSuspCompileOk) return reject(new Error('Suspended socket was allowed to compile'));
        resolve();
      }, 450);

      anonSock.on('admin_security_alert', () => { sawAdminLeak = true; });
      suspSock.on('program_started', () => { sawSuspCompileOk = true; });
      suspSock.on('connect', () => {
        suspSock.emit('compile_code', { code: 'Console.WriteLine(1);', language: 'csharp' });
      });
      anonSock.on('connect', () => {
        fetch(`${baseUrl}/audit-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
          body: JSON.stringify({ type: 'Exit Tab Violation', severity: 'Warning', desc: 'test alert' }),
        }).catch(() => {});
      });
    });

    // 9. POST /upload-raw rejects oversized Content-Length (> 200 MB)
    await new Promise((resolve, reject) => {
      const u = new URL(`${baseUrl}/upload-raw?filename=huge.mp4`);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Length': String(250 * 1024 * 1024),
        },
      }, (res) => {
        res.resume();
        if (res.statusCode === 413) resolve();
        else reject(new Error(`Expected 413 for oversized upload, got ${res.statusCode}`));
      });
      req.on('error', reject);
      req.end();
    });
  } finally {
    await stop();
  }
});
