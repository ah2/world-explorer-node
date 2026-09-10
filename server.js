require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

(async () => {
  const db = await getDb();
  const apiRoutes = require('./routes/api')(db);

  app.use('/api', apiRoutes);
  app.use('/api/*', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));

  // Page routes
  app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.get('/collections', (req, res) => res.sendFile(path.join(__dirname, 'public', 'collections.html')));
  app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.png')));

  app.listen(PORT, () => console.log(`🌍 World Explorer: http://localhost:${PORT}`));
})();