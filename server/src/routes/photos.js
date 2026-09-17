const express = require('express');
const upload = require('../middleware/upload');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadPhotos, getEventPhotos, deletePhoto } = require('../controllers/photoController');
const router = express.Router();

router.use(protect);

router.post('/events/:id/photos', restrictTo('MEMBER'), upload.array('photos', 20), uploadPhotos);
router.get('/events/:id/photos', getEventPhotos);
router.delete('/photos/:photoId', restrictTo('ADMIN'), deletePhoto);

module.exports = router;