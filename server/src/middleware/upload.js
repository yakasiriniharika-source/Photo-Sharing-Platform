const multer = require('multer');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage(); // keep file in RAM, don't write to disk

function fileFilter(req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG, and WEBP images are allowed', 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

module.exports = upload;