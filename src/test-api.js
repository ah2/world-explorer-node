require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// BASE PATH CONFIGURATION
// ============================================
// Support both local development and Nginx proxy
const BASE_PATH = process.env.BASE_PATH || '';
console.log(`📍 Base path: ${BASE_PATH || 'root'}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SERVE STATIC FILES
// ============================================
// Serve static files from the correct location
app.use(`${BASE_PATH}/css`, express.static(path.join(__dirname, 'public/css')));
app.use(`${BASE_PATH}/js`, express.static(path.join(__dirname, 'public/js')));
app.use(`${BASE_PATH}/static`, express.static(path.join(__dirname, 'public')));

// ============================================
// ROUTES
// ============================================
const authRoutes = require('./routes/authRoutes');
const mapRoutes = require('./routes/mapRoutes');

app.use(`${BASE_PATH}/api/auth`, authRoutes);
app.use(`${BASE_PATH}/api/map`, mapRoutes);

// ============================================
// SERVE FRONTEND
// ============================================
// Serve index.html for the main route
app.get(`${BASE_PATH}/`, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Also handle the base path without trailing slash
app.get(BASE_PATH || '/', (req, res) => {
    if (BASE_PATH) {
        // If we have a base path, redirect to include trailing slash
        if (!req.path.endsWith('/')) {
            return res.redirect(BASE_PATH + '/');
        }
    }
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// For local development, also serve from root
if (!BASE_PATH) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get(`${BASE_PATH}/health`, (req, res) => {
    res.json({ 
        status: 'OK', 
        basePath: BASE_PATH || 'root',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeEnv: process.env.NODE_ENV || 'development'
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
    console.log(`❌ 404: ${req.method} ${req.url}`);
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.url,
        basePath: BASE_PATH || 'root'
    });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
    console.log(`🌍 World Explorer running on http://localhost:${PORT}`);
    console.log(`📍 Base path: ${BASE_PATH || 'root'}`);
    console.log(`🔗 Access at: http://localhost:${PORT}${BASE_PATH}/`);
    console.log(`📁 Static files served from: ${BASE_PATH}/css, ${BASE_PATH}/js`);
});

module.exports = app;