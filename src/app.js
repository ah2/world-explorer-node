require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// BASE PATH CONFIGURATION
// ============================================
const BASE_PATH = process.env.BASE_PATH || '/world-explorer';
console.log(`📍 Base path: ${BASE_PATH}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SERVE STATIC FILES (with base path)
// ============================================
app.use(`${BASE_PATH}/css`, express.static(path.join(__dirname, 'public/css')));
app.use(`${BASE_PATH}/js`, express.static(path.join(__dirname, 'public/js')));
app.use(`${BASE_PATH}/static`, express.static(path.join(__dirname, 'public')));

// ============================================
// ROUTES (with base path)
// ============================================
const authRoutes = require('./routes/authRoutes');
const mapRoutes = require('./routes/mapRoutes');

app.use(`${BASE_PATH}/api/auth`, authRoutes);
app.use(`${BASE_PATH}/api/map`, mapRoutes);

// ============================================
// SERVE FRONTEND
// ============================================
app.get(`${BASE_PATH}/`, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Also handle root path for testing
app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
});

// ============================================
// HEALTH CHECK
// ============================================
app.get(`${BASE_PATH}/health`, (req, res) => {
    res.json({
        status: 'OK',
        basePath: BASE_PATH,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
    console.log(`🌍 World Explorer running on http://localhost:${PORT}`);
    console.log(`📍 Base path: ${BASE_PATH}`);
    console.log(`🔗 Access at: http://localhost:${PORT}${BASE_PATH}/`);
});

module.exports = app;