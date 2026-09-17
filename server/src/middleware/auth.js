const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Not authenticated', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token); // throws if invalid/expired

    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    next(new AppError('Not authenticated', 401));
  }
}

function restrictTo(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

module.exports = { protect, restrictTo };