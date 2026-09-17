const express = require('express');
const customerAccess = require('../middleware/customerAccess');
const {
  getGalleryInfo,
  verifyPin,
  getGalleryPhotos,
} = require('../controllers/publicGalleryController');

const router = express.Router();

// NOTE: deliberately no `protect` here — these routes are public by design
router.get('/public/galleries/:slug', getGalleryInfo);
router.post('/public/galleries/:slug/verify-pin', verifyPin);
router.get('/public/galleries/:slug/photos', customerAccess, getGalleryPhotos);

module.exports = router;