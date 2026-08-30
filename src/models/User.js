const db = require('../config/database');

class User {
    static async findByUsername(username) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
    }

    static async findById(id) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
    }

    static async create(username, password) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, password],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    static async updateScore(userId, points) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET score = score + ? WHERE id = ?',
                [points, userId],
                function(err) {
                    if (err) reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    static async updatePosition(userId, lat, lng) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET current_lat = ?, current_lng = ? WHERE id = ?',
                [lat, lng, userId],
                function(err) {
                    if (err) reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    static async getScore(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT score FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row ? row.score : 0);
                }
            );
        });
    }

    static async getAllUsers() {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT id, username, score, current_lat, current_lng, created_at FROM users ORDER BY score DESC',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });
    }
}

module.exports = User;
