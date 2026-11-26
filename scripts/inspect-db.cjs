const { openSqliteDatabase } = require('../server/db/sqlite-adapter');
const path = require('path');

const db = openSqliteDatabase(path.join(__dirname, '../server/database.sqlite'));
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log('--- Database Tables & Counts ---');
  for (const t of tables) {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
    console.log(`${t.name}: ${count}`);
  }

  console.log('\n--- Users ---');
  const users = db.prepare('SELECT id, name, email, role, status FROM users').all();
  console.table(users);
} finally {
  try { db.close(); } catch (_) {}
}
