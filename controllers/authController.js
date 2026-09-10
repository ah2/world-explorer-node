const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 3600 * 1000
};

module.exports = (db) => ({
  async register(req, res) {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (username.length < 3) return res.status(400).json({ error: 'Username too short' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ chars' });

    const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .get(username, email);
    if (exists) return res.status(409).json({ error: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
      .run(username, email, hash);

    const user = { id: info.lastInsertRowid, username, email, is_admin: 0, city: null };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, COOKIE);
    res.status(201).json({ user });
  },

  async login(req, res) {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });

    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const user = {
      id: row.id, username: row.username, email: row.email,
      is_admin: row.is_admin, city: row.city,
      city_lat: row.city_lat, city_lng: row.city_lng
    };
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('token', token, COOKIE);
    res.json({ user });
  },

  logout(req, res) {
    res.clearCookie('token').json({ message: 'Logged out' });
  },

  me(req, res) {
    const row = db.prepare('SELECT id, username, email, is_admin, city, city_lat, city_lng FROM users WHERE id = ?')
      .get(req.user.id);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json({ user: row });
  },

  setCity(req, res) {
    const { city, lat, lng } = req.body;
    if (!city || lat == null || lng == null)
      return res.status(400).json({ error: 'city, lat, lng are required' });
    db.prepare('UPDATE users SET city = ?, city_lat = ?, city_lng = ? WHERE id = ?')
      .run(city, lat, lng, req.user.id);
    res.json({ success: true, city, lat, lng });
  },

  // Public list of seed users for quick-login buttons
  seededUsers(req, res) {
    const users = db.prepare("SELECT username, is_admin FROM users WHERE password IN (SELECT password FROM users LIMIT 1) OR username IN ('admin','alice','bob','charlie','diana','eve')")
      .all();
    // Simpler: just return known usernames
    const quick = db.prepare("SELECT username FROM users WHERE username IN ('admin','alice','bob','charlie','diana','eve')").all();
    res.json({ users: quick });
  }
});