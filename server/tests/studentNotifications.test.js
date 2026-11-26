const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const { openSqliteDatabase } = require('../db/sqlite-adapter');
const {
  createStudentNotificationService,
  parseDueDeadline,
  parseReminderLeadHours,
  isMaterialItem
} = require('../services/studentNotificationService');
const { createClassroomHelpers } = require('../services/classroomAccess');
const { registerClassworkRoutes } = require('../routes/classwork');
const { registerUserRoutes } = require('../routes/users');
const { createAuthMiddleware } = require('../middleware/authMiddleware');
const {
  generateStudentNotificationEmailHtml,
  stripHtmlToText
} = require('../utils/emailService');

function createTestDb() {
  const sqlite = openSqliteDatabase(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      lastLogin TEXT,
      status TEXT DEFAULT 'Active',
      avatar TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Admin',
      lastLogin TEXT,
      status TEXT DEFAULT 'Active',
      avatar TEXT
    );
    CREATE TABLE classrooms (
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
      archived INTEGER DEFAULT 0,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER,
      student_id INTEGER,
      student_name TEXT,
      student_email TEXT,
      enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
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
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER,
      student_name TEXT,
      history TEXT,
      submittedAt TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      user_data TEXT,
      expires_at BIGINT NOT NULL
    );
    CREATE TABLE email_notifications_log (
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
    CREATE TABLE user_notification_preferences (
      user_email TEXT PRIMARY KEY,
      preferences TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return {
    isPostgres: false,
    async all(sql, ...args) { return sqlite.prepare(sql).all(...args); },
    async get(sql, ...args) { return sqlite.prepare(sql).get(...args); },
    async run(sql, ...args) { return sqlite.prepare(sql).run(...args); },
    async recordSyncDeletion() {},
    async clearSyncDeletion() {},
    triggerSync() {},
    close() { sqlite.close(); }
  };
}

test('studentNotification helpers: deadline parsing, lead hours, material detection, and HTML safety', () => {
  const dateOnly = parseDueDeadline('2026-12-01');
  assert.ok(dateOnly instanceof Date);
  assert.equal(dateOnly.getFullYear(), 2026);
  assert.equal(dateOnly.getMonth(), 11);
  assert.equal(dateOnly.getDate(), 1);
  assert.equal(dateOnly.getHours(), 23);
  assert.equal(dateOnly.getMinutes(), 59);

  assert.equal(parseDueDeadline(''), null);
  assert.equal(parseDueDeadline('invalid-date'), null);

  assert.equal(parseReminderLeadHours('24 hours before'), 24);
  assert.equal(parseReminderLeadHours('2 days before'), 48);
  assert.equal(parseReminderLeadHours('30 minutes'), 1);
  assert.equal(parseReminderLeadHours('999 hours'), 168);
  assert.equal(parseReminderLeadHours(''), 24);

  assert.equal(isMaterialItem({ activityType: 'Material' }), true);
  assert.equal(isMaterialItem({ type: 'material' }), true);
  assert.equal(isMaterialItem({ activityType: 'Activity' }), false);
  assert.equal(isMaterialItem({ activityType: 'Exam' }), false);

  const plain = stripHtmlToText('<p>Hello &amp; <strong>World</strong><br/>Line 2</p>');
  assert.equal(plain, 'Hello & World\nLine 2');

  const html = generateStudentNotificationEmailHtml({
    studentName: '<script>alert(1)</script>',
    badgeText: 'New Activity',
    badgeColor: '#10b981',
    headline: 'Test Headline',
    introText: 'Intro',
    classroomName: 'CS 101',
    instructorName: 'Prof. Ada',
    itemTitle: 'Lab 1 <b>Bold</b>',
    itemType: 'Activity',
    dueDateLabel: 'Dec 1, 2026',
    points: 100,
    detailsPreview: 'Solve the problem',
    attachmentCount: 2
  });
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(html.includes('2 files attached'), true);
  assert.equal(html.includes('border-left:'), false);
  assert.equal(html.includes('Solve the problem'), false);
});

test('studentNotificationService: notifies on new classwork & materials, deduplicates edits and concurrent saves', async () => {
  const db = createTestDb();
  const sentEmails = [];
  const notifService = createStudentNotificationService({
    db,
    emailSender: async (payload) => {
      sentEmails.push(payload);
      return { success: true, messageId: `msg_${sentEmails.length}` };
    }
  });
  const io = { emit() {}, sockets: { sockets: new Map() } };
  const classroomHelpers = createClassroomHelpers({
    db,
    io,
    onClassworkCreated: (classroomId, items) => notifService.notifyNewClassworkItems(classroomId, items)
  });

  try {
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (1, 'Prof Ada', 'ada@school.edu', 'x', 'Teacher', 'Active')");
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (2, 'Bob Student', 'bob@school.edu', 'x', 'Student', 'Active')");
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (3, 'Cara Student', 'cara@school.edu', 'x', 'Student', 'Active')");
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (4, 'Suspended Student', 'susp@school.edu', 'x', 'Student', 'Suspended')");
    await db.run("INSERT INTO classrooms (id, code, section, name, instructor, instructor_email, archived) VALUES (101, 'cs101', 'A', 'Intro to C#', 'Prof Ada', 'ada@school.edu', 0)");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 2, 'Bob Student', 'bob@school.edu')");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 3, 'Cara Student', 'cara@school.edu')");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 4, 'Suspended Student', 'susp@school.edu')");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 1, 'Prof Ada', 'ada@school.edu')");

    // Simulate concurrent HTTP PUT + Socket classwork_updated saving the same new activity and material
    const cwPayload = [
      {
        id: 1001,
        title: 'Lab 1: Loops',
        activityType: 'Activity',
        details: '<p>Write a for-loop in C#.</p>',
        dueDate: '2026-12-01',
        points: '100',
        grading: 'On',
        archived: false
      },
      {
        id: 1002,
        title: 'Week 1 Lecture Slides',
        activityType: 'Material',
        details: '<p>Review these slides before class.</p>',
        attachments: [{ name: 'slides.pdf', type: 'document' }],
        archived: false
      },
      {
        id: 1003,
        title: 'Hidden Draft Activity',
        activityType: 'Activity',
        archived: true
      }
    ];

    await Promise.all([
      classroomHelpers.saveClassworkToDb(101, cwPayload),
      classroomHelpers.saveClassworkToDb(101, cwPayload)
    ]);
    // Give non-blocking microtasks/promises a moment to settle
    await new Promise(r => setTimeout(r, 50));

    // Bob and Cara should each receive 1 classwork email + 1 material email = 4 total (Suspended & Teacher excluded, archived draft excluded)
    assert.equal(sentEmails.length, 4);
    assert.deepEqual(
      sentEmails.map(e => `${e.email}:${e.badgeText}:${e.itemTitle}`).sort(),
      [
        'bob@school.edu:New Activity:Lab 1: Loops',
        'bob@school.edu:New Material:Week 1 Lecture Slides',
        'cara@school.edu:New Activity:Lab 1: Loops',
        'cara@school.edu:New Material:Week 1 Lecture Slides'
      ].sort()
    );

    // Editing an existing item must NOT trigger another upload notification
    sentEmails.length = 0;
    const editedPayload = cwPayload.map(item => item.id === 1001 ? { ...item, title: 'Lab 1: Loops (Updated)' } : item);
    await classroomHelpers.saveClassworkToDb(101, editedPayload);
    await new Promise(r => setTimeout(r, 40));
    assert.equal(sentEmails.length, 0);
  } finally {
    db.close();
  }
});

test('studentNotificationService: sends deadline_near and missed_activity only to unsubmitted students and respects preferences', async () => {
  const db = createTestDb();
  const sentEmails = [];
  const notifService = createStudentNotificationService({
    db,
    missedLookbackMs: 7 * 24 * 60 * 60 * 1000,
    emailSender: async (payload) => {
      sentEmails.push(payload);
      return { success: true, messageId: `msg_${sentEmails.length}` };
    }
  });

  try {
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (2, 'Bob Student', 'bob@school.edu', 'x', 'Student', 'Active')");
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (3, 'Cara Student', 'cara@school.edu', 'x', 'Student', 'Active')");
    await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (4, 'Dan Student', 'dan@school.edu', 'x', 'Student', 'Active')");
    await db.run("INSERT INTO classrooms (id, code, name, instructor, archived) VALUES (101, 'cs101', 'Algorithms', 'Prof Ada', 0)");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 2, 'Bob Student', 'bob@school.edu')");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 3, 'Cara Student', 'cara@school.edu')");
    await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 4, 'Dan Student', 'dan@school.edu')");

    // Dan disables missedActivity & sets 48h reminder lead time
    await notifService.saveStudentNotificationPreferences('dan@school.edu', {
      missedActivity: false,
      reminderLeadTime: '48 hours before'
    });

    const now = new Date('2026-11-26T12:00:00.000Z');
    const dueIn10Hours = new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString();
    const dueIn36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();
    const missed2HoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const missed30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      "INSERT INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, 101, ?, ?, ?, 'Activity')",
      2001, 'Due Soon Activity', JSON.stringify({ activityType: 'Activity', details: 'Finish soon' }), dueIn10Hours
    );
    await db.run(
      "INSERT INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, 101, ?, ?, ?, 'Activity')",
      2002, 'Due In 36h Activity', JSON.stringify({ activityType: 'Activity', details: '36h away' }), dueIn36Hours
    );
    await db.run(
      "INSERT INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, 101, ?, ?, ?, 'Exam')",
      2003, 'Missed Exam', JSON.stringify({ activityType: 'Exam', details: 'Exam' }), missed2HoursAgo
    );
    await db.run(
      "INSERT INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, 101, ?, ?, ?, 'Activity')",
      2004, 'Ancient Overdue Activity', JSON.stringify({ activityType: 'Activity' }), missed30DaysAgo
    );
    await db.run(
      "INSERT INTO classwork (id, classroom_id, title, description, dueDate, type) VALUES (?, 101, ?, ?, ?, 'Material')",
      2005, 'Material With Date', JSON.stringify({ activityType: 'Material' }), missed2HoursAgo
    );

    // Bob already submitted 2001 (by name) and 2003 (by email)
    await db.run("INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (2001, 'Bob Student', '[]', ?)", now.toISOString());
    await db.run("INSERT INTO submissions (assignment_id, student_name, history, submittedAt) VALUES (2003, 'bob@school.edu', '[]', ?)", now.toISOString());

    await notifService.runDeadlineAndMissedChecks({ now });

    // Expected:
    // - 2001 (due in 10h): Cara & Dan (Bob submitted)
    // - 2002 (due in 36h): Dan ONLY (lead time 48h; Bob & Cara default 24h so not yet in window)
    // - 2003 (missed 2h ago): Cara ONLY (Bob submitted; Dan opted out of missedActivity)
    // - 2004 (missed 30d ago): none (outside 7-day lookback)
    // - 2005 (Material): none
    assert.deepEqual(
      sentEmails.map(e => `${e.email}:${e.badgeText}:${e.itemTitle}`).sort(),
      [
        'cara@school.edu:Deadline Near:Due Soon Activity',
        'cara@school.edu:Missed Activity:Missed Exam',
        'dan@school.edu:Deadline Near:Due In 36h Activity',
        'dan@school.edu:Deadline Near:Due Soon Activity'
      ].sort()
    );

    // Second run at same time must send 0 duplicates
    sentEmails.length = 0;
    await notifService.runDeadlineAndMissedChecks({ now });
    assert.equal(sentEmails.length, 0);

    // If teacher extends deadline of 2001 to a new future date within window, Cara & Dan get notified for the new deadline
    const extendedDue = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();
    await db.run('UPDATE classwork SET dueDate = ? WHERE id = 2001', extendedDue);
    await notifService.runDeadlineAndMissedChecks({ now });
    assert.deepEqual(
      sentEmails.map(e => `${e.email}:${e.itemTitle}`).sort(),
      [
        'cara@school.edu:Due Soon Activity',
        'dan@school.edu:Due Soon Activity'
      ].sort()
    );
  } finally {
    db.close();
  }
});

test('HTTP routes: /users/notification-preferences and PUT /classwork/:classroomId trigger notifications', async () => {
  const db = createTestDb();
  const sentEmails = [];
  const notifService = createStudentNotificationService({
    db,
    emailSender: async (payload) => {
      sentEmails.push(payload);
      return { success: true, messageId: `http_msg_${sentEmails.length}` };
    }
  });
  const jwtSecret = 'notif_http_test_secret_at_least_32_chars_long';
  const authMiddleware = createAuthMiddleware({ JWT_SECRET: jwtSecret, IS_RENDER_CLOUD: false });
  const io = { emit() {}, sockets: { sockets: new Map() } };
  const classroomHelpers = createClassroomHelpers({
    db,
    io,
    onClassworkCreated: (classroomId, items) => notifService.notifyNewClassworkItems(classroomId, items)
  });

  const app = express();
  app.use(express.json());
  registerUserRoutes(app, {
    db,
    io,
    JWT_SECRET: jwtSecret,
    authMiddleware,
    settingsService: { validatePassword: async () => null },
    classroomHelpers,
    studentNotificationService: notifService
  });
  registerClassworkRoutes(app, { db, io, authMiddleware, classroomHelpers });

  await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (1, 'Prof Ada', 'ada@school.edu', 'x', 'Teacher', 'Active')");
  await db.run("INSERT INTO users (id, name, email, password, role, status) VALUES (2, 'Bob Student', 'bob@school.edu', 'x', 'Student', 'Active')");
  await db.run("INSERT INTO classrooms (id, code, name, instructor, instructor_email, archived) VALUES (101, 'cs101', 'CS 101', 'Prof Ada', 'ada@school.edu', 0)");
  await db.run("INSERT INTO enrollments (classroom_id, student_id, student_name, student_email) VALUES (101, 2, 'Bob Student', 'bob@school.edu')");

  const teacherToken = jwt.sign({ id: 1, email: 'ada@school.edu', role: 'Teacher', name: 'Prof Ada' }, jwtSecret);
  const studentToken = jwt.sign({ id: 2, email: 'bob@school.edu', role: 'Student', name: 'Bob Student' }, jwtSecret);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Student updates notification preferences to opt out of newMaterial
    const putPrefs = await fetch(`${baseUrl}/users/notification-preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ newMaterial: false, reminderLeadTime: '48 hours before' })
    });
    assert.equal(putPrefs.status, 200);
    const prefsData = await putPrefs.json();
    assert.equal(prefsData.preferences.newClasswork, true);
    assert.equal(prefsData.preferences.newMaterial, false);
    assert.equal(prefsData.preferences.reminderLeadHours, 48);

    const getPrefs = await fetch(`${baseUrl}/users/notification-preferences`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(getPrefs.status, 200);
    const fetchedPrefs = await getPrefs.json();
    assert.equal(fetchedPrefs.preferences.newMaterial, false);

    // 2. Teacher uploads 1 classwork + 1 material -> Bob only gets the classwork email
    const putCw = await fetch(`${baseUrl}/classwork/101`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        classwork: [
          { id: 3001, title: 'Quiz 1', activityType: 'Quiz', dueDate: '2026-12-05' },
          { id: 3002, title: 'Reading PDF', activityType: 'Material' }
        ]
      })
    });
    assert.equal(putCw.status, 200);
    await new Promise(r => setTimeout(r, 50));

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].email, 'bob@school.edu');
    assert.equal(sentEmails[0].itemTitle, 'Quiz 1');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
