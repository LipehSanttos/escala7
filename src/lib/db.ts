import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "church.db");

// Ensure data folder exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Initialize tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS church_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'Igreja Adventista do Sétimo Dia',
    district TEXT NOT NULL DEFAULT 'Distrito Central',
    city TEXT NOT NULL DEFAULT 'São Paulo',
    state TEXT NOT NULL DEFAULT 'SP',
    logo_url TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#002F6C',
    icon TEXT NOT NULL DEFAULT 'Users',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_leader INTEGER NOT NULL DEFAULT 0,
    leader_status TEXT DEFAULT 'none',
    leader_nominated_by TEXT DEFAULT '',
    is_child INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES members(id) ON DELETE SET NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_adults ON members (phone) WHERE is_child = 0;
  CREATE INDEX IF NOT EXISTS idx_members_parent_id ON members (parent_id);

  CREATE TABLE IF NOT EXISTS member_roles (
    member_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (member_id, role_id),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS member_departments (
    member_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    is_department_leader INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (member_id, department_id),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    title TEXT NOT NULL,
    month_year TEXT NOT NULL,
    author_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedule_items (
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

  CREATE TABLE IF NOT EXISTS schedule_requests (
    id TEXT PRIMARY KEY,
    schedule_item_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    target_member_id TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_item_id) REFERENCES schedule_items(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

// Seed default data if empty
const countSettings = db.prepare("SELECT COUNT(*) as count FROM church_settings").get() as { count: number };
if (countSettings.count === 0) {
  db.prepare(`
    INSERT INTO church_settings (name, district, city, state)
    VALUES ('IASD Jardim das Flores', 'Distrito Central', 'São Paulo', 'SP')
  `).run();
}

const countDepts = db.prepare("SELECT COUNT(*) as count FROM departments").get() as { count: number };
if (countDepts.count === 0) {
  const insertDept = db.prepare("INSERT INTO departments (id, name, description, color, icon) VALUES (?, ?, ?, ?, ?)");
  const insertRole = db.prepare("INSERT INTO roles (id, department_id, name, description) VALUES (?, ?, ?, ?)");

  const depts = [
    {
      id: "diaconato",
      name: "Diaconato",
      desc: "Serviço de ordem, recepção no templo, cuidado e apoio aos cultos",
      color: "#0F4C81",
      icon: "ShieldCheck",
      roles: [
        { id: "diac_escala", name: "Diácono de Escala" },
        { id: "diac_recolhimento", name: "Recolhimento de Dízimos e Ofertas" },
        { id: "diaconisa_escala", name: "Diaconisa de Escala" },
        { id: "diac_portaria", name: "Portaria e Acolhimento" }
      ]
    },
    {
      id: "sonoplastia",
      name: "Sonoplastia e Mídia",
      desc: "Operação de som e mídia dos cultos",
      color: "#1E3A8A",
      icon: "Radio",
      roles: [
        { id: "som_e_midia", name: "Som e Mídia" }
      ]
    },
    {
      id: "recepcao",
      name: "Recepção",
      desc: "Boas-vindas calorosas aos membros e visitantes",
      color: "#047857",
      icon: "HeartHandshake",
      roles: [
        { id: "rec_manha", name: "Recepção Matutina (Culto de Sábado)" },
        { id: "rec_quarta", name: "Recepção Quarta-feira" },
        { id: "rec_domingo", name: "Recepção Domingo" }
      ]
    },
    {
      id: "escola_sabatina",
      name: "Escola Sabatina",
      desc: "Direção, louvor e ensino das classes bíblicas",
      color: "#B45309",
      icon: "BookOpen",
      roles: [
        { id: "es_direcao", name: "Direção do Programa" },
        { id: "es_louvor", name: "Dirigente de Cânticos" },
        { id: "es_professor_adultos", name: "Professor Classe Adultos" },
        { id: "es_professor_jovens", name: "Professor Classe Jovens" }
      ]
    },
    {
      id: "ministerio_louvor",
      name: "Ministério de Música e Louvor",
      desc: "Condução dos momentos de louvor congregacional e especiais",
      color: "#6D28D9",
      icon: "Music",
      roles: [
        { id: "louvor_dirigente", name: "Dirigente de Louvor" },
        { id: "louvor_teclado", name: "Pianista / Tecladista" },
        { id: "louvor_violao", name: "Violonista" },
        { id: "louvor_especial", name: "Música Especial" }
      ]
    },
    {
      id: "anciaos",
      name: "Ancionato / Direção",
      desc: "Liderança espiritual e condução da plataforma",
      color: "#1F2937",
      icon: "Crown",
      roles: [
        { id: "anciao_dia", name: "Ancião do Dia" },
        { id: "anciao_pregador", name: "Pregador / Orador" },
        { id: "anciao_oracao", name: "Oração Intercessória" }
      ]
    }
  ];

  for (const dept of depts) {
    insertDept.run(dept.id, dept.name, dept.desc, dept.color, dept.icon);
    for (const r of dept.roles) {
      insertRole.run(r.id, dept.id, r.name, "");
    }
  }

  // Seed standard members for demo
  const insertMember = db.prepare("INSERT INTO members (id, name, phone, email, is_active, is_leader) VALUES (?, ?, ?, ?, ?, ?)");
  const insertMemberRole = db.prepare("INSERT INTO member_roles (member_id, role_id) VALUES (?, ?)");
  const insertMemberDept = db.prepare("INSERT INTO member_departments (member_id, department_id, is_department_leader) VALUES (?, ?, ?)");

  const demoMembers = [
    {
      id: "m_carlos",
      name: "Carlos Eduardo Silva",
      phone: "11987654321",
      email: "carlos.silva@email.com",
      is_leader: 1,
      roles: ["diac_escala", "som_e_midia"],
      depts: [
        { id: "diaconato", is_leader: 1 },
        { id: "sonoplastia", is_leader: 0 }
      ]
    },
    {
      id: "m_mariana",
      name: "Mariana Souza Oliveira",
      phone: "11976543210",
      email: "mariana.souza@email.com",
      is_leader: 1,
      roles: ["rec_manha", "es_direcao"],
      depts: [
        { id: "recepcao", is_leader: 1 },
        { id: "escola_sabatina", is_leader: 0 }
      ]
    },
    {
      id: "m_lucas",
      name: "Lucas Gabriel Santos",
      phone: "11965432109",
      email: "lucas.santos@email.com",
      is_leader: 0,
      roles: ["som_e_midia"],
      depts: [{ id: "sonoplastia", is_leader: 0 }]
    },
    {
      id: "m_debora",
      name: "Débora Lima Ribeiro",
      phone: "11954321098",
      email: "debora.lima@email.com",
      is_leader: 0,
      roles: ["diaconisa_escala", "rec_manha"],
      depts: [
        { id: "diaconato", is_leader: 0 },
        { id: "recepcao", is_leader: 0 }
      ]
    },
    {
      id: "m_roberto",
      name: "Pr. Roberto Almeida (Ancião)",
      phone: "11943210987",
      email: "roberto.almeida@email.com",
      is_leader: 1,
      roles: ["anciao_dia", "es_professor_adultos"],
      depts: [
        { id: "anciaos", is_leader: 1 },
        { id: "escola_sabatina", is_leader: 0 }
      ]
    },
    {
      id: "m_ana",
      name: "Ana Paula Ferreira",
      phone: "11932109876",
      email: "ana.ferreira@email.com",
      is_leader: 0,
      roles: ["louvor_dirigente", "louvor_teclado"],
      depts: [{ id: "ministerio_louvor", is_leader: 0 }]
    }
  ];

  for (const m of demoMembers) {
    insertMember.run(m.id, m.name, m.phone, m.email, 1, m.is_leader);
    for (const rId of m.roles) {
      insertMemberRole.run(m.id, rId);
    }
    for (const d of m.depts) {
      insertMemberDept.run(m.id, d.id, d.is_leader);
    }
  }
}

export default db;
