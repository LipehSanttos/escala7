const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'church.db');

if (!fs.existsSync(dbPath)) {
  console.error('Arquivo data/church.db não encontrado.');
  process.exit(1);
}

const db = new Database(dbPath);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

let sql = `-- ==============================================================================
-- ESCALA7: DADOS EXPORTADOS DO BANCO LOCAL (church.db) PARA O SUPABASE
-- Execute este script no SQL Editor do Supabase após rodar o schema.sql
-- ==============================================================================

-- Garantir permissões de acesso ao schema public para a API do Supabase
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

`;

// 1. Configurações da Igreja
try {
  const church = db.prepare('SELECT * FROM church_settings LIMIT 1').get();
  if (church) {
    sql += `-- 1. Configurações da Igreja\n`;
    sql += `INSERT INTO public.churches (name, district, city, state, logo_url)\n`;
    sql += `VALUES (${escapeSql(church.name)}, ${escapeSql(church.district)}, ${escapeSql(church.city)}, ${escapeSql(church.state)}, ${escapeSql(church.logo_url)})\n`;
    sql += `ON CONFLICT DO NOTHING;\n\n`;
  }
} catch (e) {
  console.log('Sem tabela church_settings');
}

// 2. Departamentos
try {
  const depts = db.prepare('SELECT * FROM departments').all();
  if (depts.length > 0) {
    sql += `-- 2. Departamentos / Ministérios (${depts.length} registros)\n`;
    for (const d of depts) {
      sql += `INSERT INTO public.departments (id, name, description, color, icon)\n`;
      sql += `VALUES (${escapeSql(d.id)}, ${escapeSql(d.name)}, ${escapeSql(d.description)}, ${escapeSql(d.color)}, ${escapeSql(d.icon)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, icon = EXCLUDED.icon;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em departments:', e.message);
}

// 3. Funções / Cargos
try {
  const roles = db.prepare('SELECT * FROM roles').all();
  if (roles.length > 0) {
    sql += `-- 3. Funções Técnicas e Cargos (${roles.length} registros)\n`;
    for (const r of roles) {
      sql += `INSERT INTO public.roles (id, department_id, name, description)\n`;
      sql += `VALUES (${escapeSql(r.id)}, ${escapeSql(r.department_id)}, ${escapeSql(r.name)}, ${escapeSql(r.description)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, description = EXCLUDED.description;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em roles:', e.message);
}

// 4. Membros e Voluntários (Adultos primeiro, depois dependentes/crianças)
try {
  const adults = db.prepare('SELECT * FROM members WHERE is_child = 0').all();
  const children = db.prepare('SELECT * FROM members WHERE is_child = 1').all();
  const members = [...adults, ...children];

  if (members.length > 0) {
    sql += `-- 4. Membros e Voluntários (${members.length} registros)\n`;
    for (const m of members) {
      sql += `INSERT INTO public.members (id, name, phone, email, is_active, is_leader, is_child, parent_id, leader_status, leader_nominated_by, password_hash)\n`;
      sql += `VALUES (${escapeSql(m.id)}, ${escapeSql(m.name)}, ${escapeSql(m.phone || null)}, ${escapeSql(m.email || null)}, ${m.is_active ? 'TRUE' : 'FALSE'}, ${m.is_leader ? 'TRUE' : 'FALSE'}, ${m.is_child ? 'TRUE' : 'FALSE'}, ${escapeSql(m.parent_id || null)}, ${escapeSql(m.leader_status || 'none')}, ${escapeSql(m.leader_nominated_by || null)}, ${escapeSql(m.password || null)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, is_active = EXCLUDED.is_active, is_leader = EXCLUDED.is_leader, leader_status = EXCLUDED.leader_status;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em members:', e.message);
}

// 5. Vinculação Membros x Departamentos
try {
  const mDepts = db.prepare('SELECT * FROM member_departments').all();
  if (mDepts.length > 0) {
    sql += `-- 5. Vinculação de Membros com Departamentos (${mDepts.length} registros)\n`;
    for (const md of mDepts) {
      sql += `INSERT INTO public.member_departments (member_id, department_id, is_department_leader)\n`;
      sql += `VALUES (${escapeSql(md.member_id)}, ${escapeSql(md.department_id)}, ${md.is_department_leader ? 'TRUE' : 'FALSE'})\n`;
      sql += `ON CONFLICT (member_id, department_id) DO UPDATE SET is_department_leader = EXCLUDED.is_department_leader;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em member_departments:', e.message);
}

// 6. Vinculação Membros x Funções
try {
  const mRoles = db.prepare('SELECT * FROM member_roles').all();
  if (mRoles.length > 0) {
    sql += `-- 6. Vinculação de Membros com Funções (${mRoles.length} registros)\n`;
    for (const mr of mRoles) {
      sql += `INSERT INTO public.member_roles (member_id, role_id)\n`;
      sql += `VALUES (${escapeSql(mr.member_id)}, ${escapeSql(mr.role_id)})\n`;
      sql += `ON CONFLICT (member_id, role_id) DO NOTHING;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em member_roles:', e.message);
}

// 7. Escalas Mensais
try {
  const schedules = db.prepare('SELECT * FROM schedules').all();
  if (schedules.length > 0) {
    sql += `-- 7. Escalas Mensais (${schedules.length} registros)\n`;
    for (const s of schedules) {
      sql += `INSERT INTO public.schedules (id, department_id, title, month_year, author_name, status, notes)\n`;
      sql += `VALUES (${escapeSql(s.id)}, ${escapeSql(s.department_id)}, ${escapeSql(s.title)}, ${escapeSql(s.month_year)}, ${escapeSql(s.author_name)}, ${escapeSql(s.status || 'published')}, ${escapeSql(s.notes || null)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, notes = EXCLUDED.notes;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em schedules:', e.message);
}

// 8. Itens de Escala
try {
  const items = db.prepare('SELECT * FROM schedule_items').all();
  if (items.length > 0) {
    sql += `-- 8. Itens de Escala (${items.length} registros)\n`;
    for (const it of items) {
      sql += `INSERT INTO public.schedule_items (id, schedule_id, date, service_type, role_id, member_id, notes)\n`;
      sql += `VALUES (${escapeSql(it.id)}, ${escapeSql(it.schedule_id)}, ${escapeSql(it.date)}, ${escapeSql(it.service_type)}, ${escapeSql(it.role_id)}, ${escapeSql(it.member_id)}, ${escapeSql(it.notes || null)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, service_type = EXCLUDED.service_type, role_id = EXCLUDED.role_id, member_id = EXCLUDED.member_id, notes = EXCLUDED.notes;\n`;
    }
    sql += `\n`;
  }
} catch (e) {
  console.error('Erro em schedule_items:', e.message);
}

const outputPath = path.join(__dirname, '..', 'supabase', 'seed_data.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Sucesso! Arquivo gerado em: ${outputPath}`);
