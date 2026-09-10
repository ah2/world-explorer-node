const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'world-explorer.sqlite');
let wrapper = null;

function persist(rawDb) {
  fs.writeFileSync(DB_FILE, Buffer.from(rawDb.export()));
}

function flatten(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

function wrap(rawDb) {
  return {
    exec: (sql) => { rawDb.run(sql); persist(rawDb); },
    prepare: (sql) => ({
      get: (...p) => {
        const s = rawDb.prepare(sql);
        try { s.bind(flatten(p)); return s.step() ? s.getAsObject() : undefined; }
        finally { s.free(); }
      },
      all: (...p) => {
        const s = rawDb.prepare(sql); const rows = [];
        try { s.bind(flatten(p)); while (s.step()) rows.push(s.getAsObject()); return rows; }
        finally { s.free(); }
      },
      run: (...p) => {
        const s = rawDb.prepare(sql);
        try {
          s.bind(flatten(p)); s.step();
          const id = rawDb.prepare('SELECT last_insert_rowid() AS id, changes() AS c');
          id.step(); const r = id.getAsObject(); id.free();
          persist(rawDb);
          return { lastInsertRowid: r.id, changes: r.c };
        } finally { s.free(); }
      }
    })
  };
}

async function getDb() {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs({
    locateFile: f => path.join(__dirname, 'node_modules', 'sql.js', 'dist', f)
  });

  const rawDb = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      city TEXT, city_lat REAL, city_lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collected_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      place_id TEXT NOT NULL,
      place_name TEXT,
      place_category TEXT,
      place_lat REAL,
      place_lng REAL,
      points INTEGER DEFAULT 0,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, place_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS category_points (
      category TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 10
    );

    CREATE INDEX IF NOT EXISTS idx_collected_user ON collected_places(user_id);
  `);

    // Seed default category points (only if table is empty)
  const catCount = rawDb.exec("SELECT COUNT(*) AS c FROM category_points")[0]?.values[0][0] ?? 0;
  if (catCount === 0) {
    const DEFAULTS = {
      landmark: 25, monument: 25, museum: 20, art_gallery: 20, theatre: 20,
      viewpoint: 20, zoo: 20, aquarium: 20,
      hotel: 15, cinema: 15, hospital: 15, school: 15,
      bar: 12, bank: 12, brewery: 12,
      restaurant: 10, shop: 10, bakery: 10, supermarket: 10, library: 10, pharmacy: 10,
      cafe: 8, fast_food: 8, ice_cream: 6,
      park: 5,
      default: 10
    };
    const stmt = rawDb.prepare('INSERT INTO category_points (category, points) VALUES (?, ?)');
    for (const [cat, pts] of Object.entries(DEFAULTS)) {
      stmt.run([cat, pts]);
    }
    stmt.free();
  }

  persist(rawDb);

  wrapper = wrap(rawDb);
  return wrapper;
}

module.exports = { getDb };