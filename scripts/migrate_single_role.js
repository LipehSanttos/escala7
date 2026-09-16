const Database = require('better-sqlite3');
const db = new Database('./data/church.db');

db.transaction(() => {
  // Insert som_e_midia if not exists
  db.prepare(`
    INSERT OR IGNORE INTO roles (id, department_id, name, description)
    VALUES ('som_e_midia', 'sonoplastia', 'Som e Mídia', 'Operação de som e mídia')
  `).run();

  // Update schedule_items
  db.prepare(`
    UPDATE schedule_items
    SET role_id = 'som_e_midia'
    WHERE role_id IN ('som_audio', 'som_midia')
  `).run();

  // Migrate member_roles
  const membersWithAudio = db.prepare("SELECT DISTINCT member_id FROM member_roles WHERE role_id IN ('som_audio', 'som_midia')").all();
  for (const m of membersWithAudio) {
    db.prepare("INSERT OR IGNORE INTO member_roles (member_id, role_id) VALUES (?, 'som_e_midia')").run(m.member_id);
  }
  db.prepare("DELETE FROM member_roles WHERE role_id IN ('som_audio', 'som_midia')").run();

  // Delete old roles
  db.prepare("DELETE FROM roles WHERE id IN ('som_audio', 'som_midia')").run();
})();

console.log('Roles in sonoplastia:', db.prepare("SELECT * FROM roles WHERE department_id = 'sonoplastia'").all());
console.log('Schedule items count for som_e_midia:', db.prepare("SELECT COUNT(id) as c FROM schedule_items WHERE role_id = 'som_e_midia'").get());
