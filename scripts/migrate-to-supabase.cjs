const { Pool } = require('../server/node_modules/pg');
const { openSqliteDatabase } = require('../server/db/sqlite-adapter');
const fs = require('fs');
const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });

let rawUrl = (process.env.DATABASE_URL || '').trim();
if (!rawUrl) {
  console.error('DATABASE_URL is not set in server/.env');
  process.exit(1);
}
// Automatically encode special characters in password if present
const authMatch = rawUrl.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
if (authMatch) {
  const [, prefix, rawPass, suffix] = authMatch;
  if (!rawPass.includes('%25') && (rawPass.includes('%') || rawPass.includes('?'))) {
    rawUrl = `${prefix}${encodeURIComponent(rawPass)}${suffix}`;
  }
}

const useStrictTls = process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true';
const sslConfig = (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) && process.env.PG_SSL !== 'true'
  ? undefined
  : { rejectUnauthorized: useStrictTls };

const pool = new Pool({
  connectionString: rawUrl,
  ssl: sslConfig
});

const sqliteDb = openSqliteDatabase(path.join(__dirname, '../server/database.sqlite'));

async function run() {
  console.log('📡 Connecting to Supabase...');
  const client = await pool.connect();
  console.log('✅ Connected to Supabase!');

  try {
    // 1. Initialize schema
    console.log('🔨 Ensuring schema exists...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../server/db/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('✅ Schema ready.');

    // 2. Migrate Users
    const users = sqliteDb.prepare('SELECT name, email, password, role, lastLogin, status FROM users').all();
    console.log(`👥 Migrating ${users.length} users...`);
    for (const u of users) {
      await client.query(`
        INSERT INTO users (name, email, password, role, lastlogin, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          status = EXCLUDED.status;
      `, [u.name, u.email, u.password, u.role, u.lastLogin, u.status || 'Active']);
    }
    console.log('✅ Users migrated.');

    // 3. Migrate Classrooms
    const classrooms = sqliteDb.prepare('SELECT id, code, section, name, subject, instructor, archived, instructor_email, theme FROM classrooms').all();
    console.log(`🏫 Migrating ${classrooms.length} classrooms...`);
    for (const c of classrooms) {
      await client.query(`
        INSERT INTO classrooms (id, code, section, name, subject, instructor, archived, instructor_email, theme)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          section = EXCLUDED.section,
          subject = EXCLUDED.subject,
          instructor = EXCLUDED.instructor,
          archived = EXCLUDED.archived,
          instructor_email = EXCLUDED.instructor_email,
          theme = EXCLUDED.theme;
      `, [c.id, c.code || '', c.section || '', c.name || '', c.subject || '', c.instructor || '', c.archived || 0, c.instructor_email || null, c.theme || null]);
    }
    console.log('✅ Classrooms migrated.');

    // 4. Migrate Classwork
    const classwork = sqliteDb.prepare('SELECT id, classroom_id, title, description, dueDate, type FROM classwork').all();
    console.log(`📝 Migrating ${classwork.length} classwork assignments...`);
    for (const cw of classwork) {
      const crCheck = await client.query('SELECT id FROM classrooms WHERE id = $1', [cw.classroom_id]);
      if (crCheck.rows.length === 0) {
        await client.query('INSERT INTO classrooms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [cw.classroom_id, 'Classroom ' + cw.classroom_id]);
      }
      await client.query(`
        INSERT INTO classwork (id, classroom_id, title, description, duedate, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          duedate = EXCLUDED.duedate,
          type = EXCLUDED.type;
      `, [cw.id, cw.classroom_id, cw.title, cw.description || '', cw.dueDate || '', cw.type || 'Assignment']);
    }
    console.log('✅ Classwork migrated.');

    // 5. Migrate Enrollments
    const enrollments = sqliteDb.prepare('SELECT classroom_id, student_id, student_name, student_email, enrolled_at FROM enrollments').all();
    console.log(`🎒 Migrating ${enrollments.length} enrollments...`);
    for (const e of enrollments) {
      await client.query(`
        INSERT INTO enrollments (classroom_id, student_id, student_name, student_email, enrolled_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (classroom_id, student_email) DO NOTHING;
      `, [e.classroom_id, e.student_id || null, e.student_name || '', (e.student_email || '').trim().toLowerCase(), e.enrolled_at || null]);
    }
    console.log('✅ Enrollments migrated.');

    // 6. Migrate Announcements
    const announcements = sqliteDb.prepare('SELECT id, classroom_id, title, details, author, posted FROM announcements').all();
    console.log(`📢 Migrating ${announcements.length} announcements...`);
    for (const a of announcements) {
      await client.query(`
        INSERT INTO announcements (id, classroom_id, title, details, author, posted)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          details = EXCLUDED.details,
          author = EXCLUDED.author,
          posted = EXCLUDED.posted;
      `, [a.id, a.classroom_id, a.title || '', a.details || '', a.author || '', a.posted || null]);
    }
    console.log('✅ Announcements migrated.');

    // 7. Migrate Submissions & Grades
    const submissions = sqliteDb.prepare('SELECT assignment_id, student_name, history, submittedAt FROM submissions').all();
    console.log(`📤 Migrating ${submissions.length} submissions...`);
    for (const s of submissions) {
      await client.query('DELETE FROM submissions WHERE assignment_id = $1 AND LOWER(TRIM(student_name)) = LOWER(TRIM($2))', [s.assignment_id, s.student_name]);
      await client.query(`
        INSERT INTO submissions (assignment_id, student_name, history, submittedat)
        VALUES ($1, $2, $3, $4);
      `, [s.assignment_id, s.student_name, s.history || '[]', s.submittedAt || null]);
    }
    console.log('✅ Submissions migrated.');

    const grades = sqliteDb.prepare('SELECT assignment_id, student_id, grade, feedback, graded_at, updated_at FROM grades').all();
    console.log(`🏅 Migrating ${grades.length} grades...`);
    for (const g of grades) {
      await client.query(`
        INSERT INTO grades (assignment_id, student_id, grade, feedback, graded_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (assignment_id, student_id) DO UPDATE SET
          grade = EXCLUDED.grade,
          feedback = EXCLUDED.feedback,
          graded_at = EXCLUDED.graded_at,
          updated_at = EXCLUDED.updated_at;
      `, [g.assignment_id, g.student_id, g.grade ?? null, g.feedback || '', g.graded_at || null, g.updated_at || new Date().toISOString()]);
    }
    console.log('✅ Grades migrated.');

    // 8. Verification
    const uCount = (await client.query('SELECT COUNT(*) FROM users')).rows[0].count;
    const cCount = (await client.query('SELECT COUNT(*) FROM classrooms')).rows[0].count;
    const cwCount = (await client.query('SELECT COUNT(*) FROM classwork')).rows[0].count;
    const eCount = (await client.query('SELECT COUNT(*) FROM enrollments')).rows[0].count;
    const sCount = (await client.query('SELECT COUNT(*) FROM submissions')).rows[0].count;
    console.log('\n🎉 Supabase Database is 100% Populated & Synced!');
    console.log(`- Users in Supabase: ${uCount}`);
    console.log(`- Classrooms in Supabase: ${cCount}`);
    console.log(`- Classwork in Supabase: ${cwCount}`);
    console.log(`- Enrollments in Supabase: ${eCount}`);
    console.log(`- Submissions in Supabase: ${sCount}`);

  } finally {
    client.release();
    await pool.end();
    sqliteDb.close();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
