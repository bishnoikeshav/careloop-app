const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../services/store');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token' });
    }
    const user = store.findUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access restricted to ${role} role` });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
