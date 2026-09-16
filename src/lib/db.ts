let _sqliteDb: any = null;
let _sqliteInitAttempted = false;

function initSqlite() {
  if (_sqliteDb) return _sqliteDb;
  if (_sqliteInitAttempted) return null;
  _sqliteInitAttempted = true;

  try {
    // Carregamento dinâmico para não quebrar no Cloudflare Workers / Serverless Edge
    const Database = require("better-sqlite3");
    const path = require("path");
    const fs = require("fs");

    const dbPath = path.join(process.cwd(), "data", "church.db");
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    // Inicializar tabelas se não existirem
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

    _sqliteDb = db;
    return _sqliteDb;
  } catch (err: any) {
    // No Cloudflare Workers ou Serverless Edge, better-sqlite3 não está disponível
    return null;
  }
}

/**
 * Proxy seguro para compatibilidade com chamadas db.prepare() ou db.exec()
 */
const db = {
  prepare(sql: string) {
    const realDb = initSqlite();
    if (!realDb) {
      return {
        all: () => [],
        get: () => null,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }
    return realDb.prepare(sql);
  },
  exec(sql: string) {
    const realDb = initSqlite();
    if (!realDb) return;
    return realDb.exec(sql);
  },
  transaction(fn: (...args: any[]) => any) {
    const realDb = initSqlite();
    if (!realDb) return fn;
    return realDb.transaction(fn);
  },
};


export default db;
