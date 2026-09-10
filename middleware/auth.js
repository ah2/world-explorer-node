const jwt = require('jsonwebtoken');

function readUser(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
}

exports.auth = (req, res, next) => {
  const user = readUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
};

exports.admin = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
};