const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const { createGallery, updateGalleryPhotos, publishGallery, getGalleryByEvent } = require('../controllers/galleryController');

const router = express.Router();

router.use(protect);

router.post('/events/:id/gallery', restrictTo('ADMIN'), createGallery);
router.patch('/galleries/:id/photos', restrictTo('ADMIN'), updateGalleryPhotos);
router.post('/galleries/:id/publish', restrictTo('ADMIN'), publishGallery);
router.get('/events/:id/gallery', restrictTo('ADMIN'), getGalleryByEvent);

module.exports = router;