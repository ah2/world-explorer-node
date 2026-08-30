const db = require('../config/database');

class Location {
    static async collect(userId, name, lat, lng, points = 10) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO locations (user_id, name, lat, lng, points) VALUES (?, ?, ?, ?, ?)',
                [userId, name, lat, lng, points],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    static async getUserLocations(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM locations 
                 WHERE user_id = ? 
                 ORDER BY collected_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    static async isCollected(userId, lat, lng, radius = 0.001) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM locations 
                 WHERE user_id = ? 
                 AND ABS(lat - ?) < ? 
                 AND ABS(lng - ?) < ?`,
                [userId, lat, radius, lng, radius],
                (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                }
            );
        });
    }

    static async getTotalCollected(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count, SUM(points) as total_points FROM locations WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    resolve({
                        count: row ? row.count : 0,
                        totalPoints: row ? row.total_points : 0
                    });
                }
            );
        });
    }

    static async deleteLocation(id, userId) {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM locations WHERE id = ? AND user_id = ?',
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    resolve(this.changes);
                }
            );
        });
    }
}

module.exports = Location;
