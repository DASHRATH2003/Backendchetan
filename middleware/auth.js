const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // For development/demo purposes, bypass auth checks
  console.log('Auth middleware - development mode, bypassing checks');
  // Set a default user for development
  req.user = {
    id: '123456789', // Default user ID for development
    role: 'admin' // Default role for development
  };
  return next();

  // The following code would be used in production:
  /*
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'No authentication token, authorization denied' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid' 
    });
  }
  */
};

module.exports = auth; 