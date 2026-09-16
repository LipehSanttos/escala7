const Database = require('better-sqlite3');
const db = new Database('./data/church.db');

db.transaction(() => {
  // Disable foreign keys temporarily
  db.pragma('foreign_keys = OFF');

  // Create new schedule_items table with nullable member_id
  db.exec(`
    CREATE TABLE schedule_items_new (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      role_id TEXT NOT NULL,
      member_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
    );

    INSERT INTO schedule_items_new (id, schedule_id, date, service_type, role_id, member_id, notes, created_at)
    SELECT id, schedule_id, date, service_type, role_id, member_id, notes, created_at
    FROM schedule_items;

    DROP TABLE schedule_items;

    ALTER TABLE schedule_items_new RENAME TO schedule_items;
  `);

  db.pragma('foreign_keys = ON');
})();

console.log('PRAGMA table_info(schedule_items):', db.prepare('PRAGMA table_info(schedule_items)').all());
console.log('Count of items:', db.prepare('SELECT count(id) as total FROM schedule_items').get());
