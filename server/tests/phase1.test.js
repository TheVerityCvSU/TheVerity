const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io: ioc } = require('socket.io-client');

const { hashPassword, verifyPassword, isHashedPassword, sanitizeUser } = require('../utils/passwordHash');
const { scanCSharpCode } = require('../csharpSecurityScanner');
const {
  isAllowedExternalUrl,
  isAllowedGoogleAuthUrl,
  isAuthorizedIpcSender,
  resolveSafeDistFile,
} = require('../../electron/security-utils.cjs');

test('passwordHash: hashes, verifies scrypt & lazy plaintext upgrade, sanitizes user', () => {
  const hash = hashPassword('Verity@2026');
  assert.equal(isHashedPassword(hash), true);
  assert.deepEqual(verifyPassword('Verity@2026', hash), { valid: true, needsUpgrade: false });
  assert.deepEqual(verifyPassword('wrongpass', hash), { valid: false, needsUpgrade: false });

  // Legacy plaintext check triggers lazy scrypt upgrade
  assert.deepEqual(verifyPassword('legacyPass', 'legacyPass'), { valid: true, needsUpgrade: true });
  assert.deepEqual(verifyPassword('bad', 'legacyPass'), { valid: false, needsUpgrade: false });
  assert.deepEqual(verifyPassword('anything', 'google_sso_user'), { valid: false, needsUpgrade: false });

  const sanitized = sanitizeUser({ id: 1, email: 'a@b.com', password: hash, role: 'Student' });
  assert.equal('password' in sanitized, false);
  assert.equal(sanitized.email, 'a@b.com');
});

test('csharpSecurityScanner: blocks bypass vectors and permits clean C#', () => {
  assert.equal(scanCSharpCode('using System;\nConsole.WriteLine("Hello Verity!");').isSafe, true);

  assert.equal(scanCSharpCode('using SysDiag = System.Diagnostics;\nSysDiag.Process.Start("calc");').isSafe, false);
  assert.equal(scanCSharpCode('using System.IO.Compression;\nZipFile.ExtractToDirectory("a", "b");').isSafe, false);
  assert.equal(scanCSharpCode('using System.Xml.Linq;\nXDocument.Load("http://evil");').isSafe, false);
  assert.equal(scanCSharpCode('Span<byte> buf = stackalloc byte[16];').isSafe, false);
  assert.equal(scanCSharpCode('var args = Environment.GetCommandLineArgs();').isSafe, false);
  assert.equal(scanCSharpCode('var x = "po" + "wershell" + ".exe";').isSafe, false);
  assert.equal(scanCSharpCode('System.Diagnostics.Process.Start("cmd.exe");').isSafe, false);
});

test('electron security-utils: blocks unsafe URLs, spoofed Google URLs, unauthorized senders, and traversal', () => {
  assert.equal(isAllowedExternalUrl('https://learn.microsoft.com/dotnet/'), true);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe'), false);
  assert.equal(isAllowedExternalUrl('ms-msdt:id'), false);

  assert.equal(isAllowedGoogleAuthUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
  assert.equal(isAllowedGoogleAuthUrl('http://localhost:3001/auth/google/external'), true);
  assert.equal(isAllowedGoogleAuthUrl('https://attacker.example/?accounts.google.com'), false);
  assert.equal(isAllowedGoogleAuthUrl('https://attacker.example/auth/google'), false);

  assert.equal(isAuthorizedIpcSender({ senderFrame: { url: 'http://localhost:5173/#/admin' } }), true);
  assert.equal(isAuthorizedIpcSender({ senderFrame: { url: 'file:///C:/app/dist/index.html' } }), true);
  assert.equal(isAuthorizedIpcSender({ senderFrame: { url: 'https://evil.example/payload.html' } }), false);

  const distDir = path.join(os.tmpdir(), 'verity_test_dist');
  assert.equal(resolveSafeDistFile(distDir, '/assets/app.js').safe, true);
  assert.equal(resolveSafeDistFile(distDir, '/%2e%2e/server/.env').safe, false);
  assert.equal(resolveSafeDistFile(distDir, '/../package.json').safe, false);
});

test('server Phase 1 HTTP RBAC, lazy scrypt login, Teacher->Student->Admin workflow, and Socket.IO auth', async () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity_p1_test_'));
  const port = 39817;
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverPath = path.resolve(__dirname, '../server.js');

  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: tempDataDir,
      IS_LAN_HOST: 'false',
      VERITY_SKIP_DOTENV: '1',
      DATABASE_URL: '',
      JWT_SECRET: 'phase1_test_secret_at_least_32_chars_long_123',
      VERITY_BOOTSTRAP_ADMIN_EMAIL: 'admin@testverity.local',
      VERITY_BOOTSTRAP_ADMIN_PASSWORD: 'Admin@2026!Secure',
      VERITY_BOOTSTRAP_ADMIN_NAME: 'Test Admin',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  try {
    // Wait until /health responds 200
    let healthy = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'operational') {
            healthy = true;
            break;
          }
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(healthy, true, `Server failed to become healthy.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

    // 1. Default hardcoded 'admin' without bootstrap credentials must fail; bootstrap admin succeeds
    const badAdminRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@verity.com', password: 'admin' }),
    });
    assert.equal(badAdminRes.status, 401);

    const adminLoginRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@testverity.local', password: 'Admin@2026!Secure' }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminLoginData = await adminLoginRes.json();
    assert.ok(adminLoginData.token);
    assert.equal('password' in adminLoginData.user, false);
    const adminToken = adminLoginData.token;

    // 2. Unauthenticated /register and /upload must be rejected
    const unauthRegister = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker', email: 'h@x.com', password: 'Password@123' }),
    });
    assert.equal(unauthRegister.status, 401);

    const unauthUpload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'evil.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }),
    });
    assert.equal(unauthUpload.status, 401);

    // Unsigned / forged JWT must fail verification
    const forgedJwt = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0dmVyaXR5LmxvY2FsIiwicm9sZSI6IkFkbWluIn0.';
    const forgedReq = await fetch(`${baseUrl}/users`, { headers: { Authorization: `Bearer ${forgedJwt}` } });
    assert.equal(forgedReq.status, 403);

    // 3. Admin creates Teacher & Student accounts (no password leaked in response)
    const createTeacher = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Prof Alice', email: 'alice@school.edu', password: 'Teacher@2026!', role: 'Teacher' }),
    });
    assert.equal(createTeacher.status, 201);
    const teacherCreated = await createTeacher.json();
    assert.equal('password' in teacherCreated.user, false);

    const createStudent = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Bob Student', email: 'bob@school.edu', password: 'Student@2026!', role: 'Student' }),
    });
    assert.equal(createStudent.status, 201);
    const studentCreated = await createStudent.json();
    assert.equal('password' in studentCreated.user, false);

    // 4. Teacher and Student login succeed without leaking passwords
    const teacherLogin = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@school.edu', password: 'Teacher@2026!' }),
    });
    assert.equal(teacherLogin.status, 200);
    const teacherData = await teacherLogin.json();
    assert.equal('password' in teacherData.user, false);
    const teacherToken = teacherData.token;

    const studentLogin = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@school.edu', password: 'Student@2026!' }),
    });
    assert.equal(studentLogin.status, 200);
    const studentData = await studentLogin.json();
    assert.equal('password' in studentData.user, false);
    const studentToken = studentData.token;

    // 5. Classroom + Classwork flow & RBAC boundary checks
    const createCls = await fetch(`${baseUrl}/classrooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        classrooms: [{ id: 101, code: 'cs101', section: 'A', name: 'CS 101', subject: 'C#', instructor: 'Prof Alice', instructorEmail: 'alice@school.edu' }],
      }),
    });
    assert.equal(createCls.status, 200);

    const saveCw = await fetch(`${baseUrl}/classwork/101`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        classwork: [{ id: 201, title: 'Lab 1', description: 'Hello world', type: 'Assignment' }],
      }),
    });
    assert.equal(saveCw.status, 200);

    // Student joins via /classrooms/join
    const joinRes = await fetch(`${baseUrl}/classrooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ code: 'cs101' }),
    });
    assert.equal(joinRes.status, 200);

    // Student must NOT delete grades or enroll users or read /notifications
    const stuDelGrade = await fetch(`${baseUrl}/grades/201/Bob%20Student`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(stuDelGrade.status, 403);

    const stuEnroll = await fetch(`${baseUrl}/classrooms/101/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ studentEmail: 'bob@school.edu' }),
    });
    assert.equal(stuEnroll.status, 403);

    const stuNotifs = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(stuNotifs.status, 403);

    // Deleting the last classwork item explicitly with [] must succeed
    const clearCw = await fetch(`${baseUrl}/classwork/101`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ classwork: [] }),
    });
    assert.equal(clearCw.status, 200);
    const clearedData = await clearCw.json();
    assert.equal(clearedData.classwork.length, 0);

    // 6. Socket.IO: spoofed role/CompilerView blocked, authenticated code security check works
    await new Promise((resolve, reject) => {
      const sock = ioc(baseUrl, { transports: ['websocket'] });
      const timer = setTimeout(() => {
        sock.disconnect();
        reject(new Error('Socket test timeout'));
      }, 8000);

      sock.on('connect', () => {
        // Attempt unauthenticated CompilerView sandbox compile -> must be rejected
        sock.emit('compile_code', { username: 'CompilerView', code: 'Console.WriteLine(1);' });
      });

      let sawAuthError = false;
      sock.on('process_exit', () => {
        if (!sawAuthError) {
          sawAuthError = true;
          // Now authenticate with real student token and try malicious code
          sock.emit('authenticate', { token: studentToken });
        }
      });

      sock.on('authenticated', () => {
        sock.emit('teacher_join', { classroomId: '101', assignmentId: '201', user: { role: 'Teacher' } });
      });

      sock.on('error', (err) => {
        if (err?.message?.includes('Teacher role required')) {
          sock.emit('compile_code', {
            code: 'using System.Diagnostics;\nProcess.Start("calc");',
            language: 'csharp',
          });
        }
      });

      sock.on('terminal_output', (msg) => {
        if (String(msg).includes('Security') || String(msg).includes('prohibited') || String(msg).includes('Authentication required')) {
          if (sawAuthError && (String(msg).includes('Security') || String(msg).includes('prohibited'))) {
            clearTimeout(timer);
            sock.disconnect();
            resolve();
          }
        }
      });
    });
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    try { fs.rmSync(tempDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
