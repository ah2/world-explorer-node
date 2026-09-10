require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

const SEED_USERS = [
  { username: 'admin',   email: 'admin@example.com',   password: 'admin123',   is_admin: 1 },
  { username: 'alice',   email: 'alice@example.com',   password: 'password123', is_admin: 0 },
  { username: 'bob',     email: 'bob@example.com',     password: 'password123', is_admin: 0 },
  { username: 'charlie', email: 'charlie@example.com', password: 'password123', is_admin: 0 },
  { username: 'diana',   email: 'diana@example.com',   password: 'password123', is_admin: 0 },
  { username: 'eve',     email: 'eve@example.com',     password: 'password123', is_admin: 0 }
];

(async () => {
  const db = await getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

  // If users already exist, don't reseed
  if (count > 0) {
    console.log(`ℹ️  Database has ${count} user(s). Skipping seed.`);
    process.exit(0);
  }

  console.log('🌱 Seeding users...');
  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    db.prepare('INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)')
      .run(u.username, u.email, hash, u.is_admin);
  }
  console.log(`✅ Created ${SEED_USERS.length} users:`);
  SEED_USERS.forEach(u => console.log(`   - ${u.username} / ${u.password}${u.is_admin ? ' (admin)' : ''}`));
  process.exit(0);
})().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});