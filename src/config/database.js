const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'world_explorer.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Users table - removed 'role' column
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            current_lat REAL DEFAULT 0,
            current_lng REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('✅ Users table ready');
        }
    });

    // Locations table
    db.run(`
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            lat REAL,
            lng REAL,
            points INTEGER DEFAULT 10,
            collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating locations table:', err);
        } else {
            console.log('✅ Locations table ready');
        }
    });

    // Insert default users if they don't exist
    const defaultUsers = [
        ['admin', '$2a$10$YQoJ9aXJgZwfYLYvJYF/6O3GgxHkRrWpQhVjXbR5tP7nM8qKxL9cC'],
        ['alice', '$2a$10$YQoJ9aXJgZwfYLYvJYF/6O3GgxHkRrWpQhVjXbR5tP7nM8qKxL9cC'],
        ['bob', '$2a$10$YQoJ9aXJgZwfYLYvJYF/6O3GgxHkRrWpQhVjXbR5tP7nM8qKxL9cC']
    ];

    defaultUsers.forEach(([username, password]) => {
        db.run(
            `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
            [username, password],
            (err) => {
                if (err) {
                    console.error(`Error inserting user ${username}:`, err);
                }
            }
        );
    });
});

// Close database gracefully
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

module.exports = db;
