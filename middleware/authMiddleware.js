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

module.exports = { requireAdmin, requireAuth };
