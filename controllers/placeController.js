const overture = require('../utils/overture');
const categories = require('../utils/categories');

// Helper — get points map from DB
function loadPointsMap(db) {
  const rows = db.prepare('SELECT category, points FROM category_points').all();
  const map = { default: 10 };
  for (const r of rows) map[r.category] = r.points;
  return map;
}

function applyPoints(places, pointsMap) {
  return places.map(p => ({
    ...p,
    points_value: pointsMap[p.category] ?? pointsMap.default ?? 10
  }));
}

module.exports = (db) => ({
  // ===== PUBLIC =====
  async getPlaces(req, res) {
    const { lat, lng, radius = 3000, category } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    try {
      const { places, total } = await overture.fetchAllPages({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseInt(radius),
        category: category || ''
      });
      const pointsMap = loadPointsMap(db);
      res.json({ places: applyPoints(places, pointsMap), total });
    } catch (err) {
      console.error('Overture error:', err.message);
      res.status(500).json({ error: 'Failed to fetch places' });
    }
  },

  async getPlaceById(req, res) {
    const place = await overture.getPlaceById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    const pointsMap = loadPointsMap(db);
    res.json(applyPoints([place], pointsMap)[0]);
  },

  getCategories(req, res) {
    res.json({ categories });
  },

  // Public — needed by map to show points on new markers
  getCategoryPoints(req, res) {
    res.json({ points: loadPointsMap(db) });
  },

  // ===== PROTECTED =====
  async collectPlace(req, res) {
    const { placeId, placeName, placeCategory, placeLat, placeLng } = req.body;
    if (!placeId) return res.status(400).json({ error: 'placeId required' });

    const existing = db.prepare('SELECT id FROM collected_places WHERE user_id = ? AND place_id = ?')
      .get(req.user.id, placeId);
    if (existing) return res.status(409).json({ error: 'Already collected' });

    // Server decides the points — never trust the client.
    const pointsMap = loadPointsMap(db);
    const cat = (placeCategory || '').toLowerCase();
    const earned = pointsMap[cat] ?? pointsMap.default ?? 10;

    db.prepare(`INSERT INTO collected_places
      (user_id, place_id, place_name, place_category, place_lat, place_lng, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(req.user.id, placeId, placeName || null, cat || null,
           placeLat || null, placeLng || null, earned);

    const stats = db.prepare(
      'SELECT COUNT(*) AS c, COALESCE(SUM(points), 0) AS p FROM collected_places WHERE user_id = ?'
    ).get(req.user.id);

    res.json({ success: true, points: earned, total: stats.c, totalPoints: stats.p });
  },

  async getUserCollections(req, res) {
    const rows = db.prepare(`
      SELECT place_id, place_name, place_category, place_lat, place_lng, points, collected_at
      FROM collected_places WHERE user_id = ? ORDER BY collected_at DESC
    `).all(req.user.id);

    const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
    const byCategory = {};
    for (const r of rows) {
      const c = r.place_category || 'unknown';
      byCategory[c] = (byCategory[c] || 0) + 1;
    }

    res.json({
      places: rows.map(r => ({
        id: r.place_id, name: r.place_name, category: r.place_category,
        lat: r.place_lat, lng: r.place_lng, points: r.points, collected_at: r.collected_at
      })),
      count: rows.length,
      totalPoints,
      byCategory
    });
  },

  // ===== ADMIN =====
  async adminGetUsers(req, res) {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.is_admin, u.city, u.created_at,
             (SELECT COUNT(*) FROM collected_places WHERE user_id = u.id) AS collected_count,
             (SELECT COALESCE(SUM(points), 0) FROM collected_places WHERE user_id = u.id) AS total_points
      FROM users u ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  },

  async adminGetCollections(req, res) {
    const collections = db.prepare(`
      SELECT c.*, u.username FROM collected_places c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.collected_at DESC LIMIT 500
    `).all();
    res.json({ collections });
  },

  async adminDeleteCollection(req, res) {
    db.prepare('DELETE FROM collected_places WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  },

  // Points management
  adminGetCategoryPoints(req, res) {
    res.json({ points: loadPointsMap(db) });
  },

  adminSetCategoryPoints(req, res) {
    const { category, points } = req.body;
    if (!category || typeof points !== 'number' || points < 0 || points > 9999) {
      return res.status(400).json({ error: 'category and valid points (0-9999) required' });
    }
    db.prepare(`
      INSERT INTO category_points (category, points) VALUES (?, ?)
      ON CONFLICT(category) DO UPDATE SET points = excluded.points
    `).run(category.toLowerCase(), Math.floor(points));
    res.json({ success: true, points: loadPointsMap(db) });
  }
});