const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');

// Shared: find a gallery by slug, but only if it's published.
// Deliberately throws the SAME error for "doesn't exist" and "not published".
async function findPublishedGallery(slug) {
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: { event: true },
  });
  if (!gallery || !gallery.published) {
    throw new AppError('Gallery not found', 404);
  }
  return gallery;
}

async function getGalleryInfo(req, res, next) {
  try {
    const gallery = await findPublishedGallery(req.params.slug);
    res.json({ eventName: gallery.event.name });
  } catch (err) {
    next(err);
  }
}

async function verifyPin(req, res, next) {
  try {
    const { pin } = req.body;
    if (!pin) throw new AppError('pin is required', 400);

    const gallery = await findPublishedGallery(req.params.slug);

    const isMatch = await bcrypt.compare(pin, gallery.pinHash);
    if (!isMatch) throw new AppError('Incorrect PIN', 401);

    const accessToken = signToken({ galleryId: gallery.id, type: 'customer' }, '2h');

    const photos = await fetchGalleryPhotos(gallery.id);

    res.json({ accessToken, eventName: gallery.event.name, photos });
  } catch (err) {
    next(err);
  }
}

async function getGalleryPhotos(req, res, next) {
  try {
    const gallery = await findPublishedGallery(req.params.slug);

    // the token must belong to THIS specific gallery, not just any gallery
    if (req.customerAccess.galleryId !== gallery.id) {
      throw new AppError('Access token does not match this gallery', 403);
    }

    const photos = await fetchGalleryPhotos(gallery.id);
    res.json({ eventName: gallery.event.name, photos });
  } catch (err) {
    next(err);
  }
}

async function fetchGalleryPhotos(galleryId) {
  const galleryPhotos = await prisma.galleryPhoto.findMany({
    where: { galleryId },
    include: { photo: true },
  });
  return galleryPhotos.map((gp) => ({
    id: gp.photo.id,
    url: gp.photo.storageUrl,
  }));
}

module.exports = { getGalleryInfo, verifyPin, getGalleryPhotos };