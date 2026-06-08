const jwt = require('jsonwebtoken');

// Middleware to protect Admin Routes
const requireAdmin = (req, res, next) => {
  // Get token from the headers
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key_here_12345');
    
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

// You can add a similar middleware for students: `requireStudent`

module.exports = { requireAdmin };