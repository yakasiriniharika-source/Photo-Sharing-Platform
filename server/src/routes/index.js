const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const publicGalleryRoutes = require('./publicGallery');
const eventRoutes = require('./events');
const photoRoutes = require('./photos');
const galleryRoutes = require('./gallery');

const router = express.Router();
router.use(healthRoutes);
router.use(authRoutes);
router.use(publicGalleryRoutes);
router.use(eventRoutes);     
router.use(photoRoutes);
router.use(galleryRoutes);

module.exports = router;