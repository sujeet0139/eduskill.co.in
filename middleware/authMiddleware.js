const { jwt, JWT_SECRET, getTokenFromReq } = require('../config/jwt');

// Middleware to protect Admin Routes. Accepts the token from either the
// httpOnly session cookie or an Authorization: Bearer header.
const requireAdmin = (req, res, next) => {
  const token = getTokenFromReq(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the user role is an admin or moderator
    if (decoded.role !== 'admin' && decoded.role !== 'moderator') {
      return res.status(403).json({ error: 'Access denied. Requires admin privileges.' });
    }

    // Attach admin data to request object
    req.admin = decoded;
    next(); // Move to the actual API controller
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// RBAC (master-dev-prompt Section H#2). Must run after `requireAdmin` (relies
// on req.admin already being set -- either from the inline middleware or,
// more commonly in this codebase, the app-level `app.use(path, requireAdmin,
// router)` mount in server.js). Restricts a route to specific admin_users
// roles -- e.g. requireRole('admin') to keep "system config" screens
// (Settings, form builder, managing other admin accounts) away from the
// 'moderator' role (today's Admin/Data-Entry-Staff tier), without touching
// the existing 'admin'/'moderator' values already stored on real accounts.
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  if (!allowedRoles.includes(req.admin.role)) {
    return res.status(403).json({ error: `Access denied. Requires one of: ${allowedRoles.join(', ')}.` });
  }
  next();
};

// Generic "is logged in" guard (any role). Used by /api/auth/me.
const requireAuth = (req, res, next) => {
  const token = getTokenFromReq(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = { requireAdmin, requireAuth, requireRole };
