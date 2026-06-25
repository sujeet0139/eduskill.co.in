const { jwt, JWT_SECRET, getTokenFromReq } = require('../config/jwt');

// Protect student routes. Accepts the token from either the httpOnly session
// cookie or an Authorization: Bearer header.
const requireStudent = (req, res, next) => {
  const token = getTokenFromReq(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'student') {
      return res.status(403).json({ error: 'Forbidden: Student access required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = { requireStudent };
