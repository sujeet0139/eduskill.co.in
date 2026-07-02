const { jwt, JWT_SECRET, getTokenFromReq } = require('../config/jwt');

// Protect teacher routes. Accepts the token from the httpOnly cookie or a
// Bearer header. The JWT is issued by POST /api/auth/teacher/login with role
// 'teacher' and id = teachers.id.
const requireTeacher = (req, res, next) => {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden: Teacher access required' });
    }
    req.teacher = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = { requireTeacher };
