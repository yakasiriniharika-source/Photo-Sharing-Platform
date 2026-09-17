const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function customerAccess(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.type !== 'customer') {
      throw new AppError('Invalid access token', 401);
    }

    req.customerAccess = { galleryId: decoded.galleryId };
    next();
  } catch (err) {
    next(new AppError('Access token required or expired', 401));
  }
}

module.exports = customerAccess;