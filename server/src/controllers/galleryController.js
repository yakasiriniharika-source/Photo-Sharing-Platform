const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateSlug } = require('../utils/slug');

// Fetches a gallery + its event, and confirms req.user is the owning Admin.
async function getOwnedGallery(galleryId, user) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    include: { event: true },
  });
  if (!gallery) throw new AppError('Gallery not found', 404);
  if (user.role !== 'ADMIN' || gallery.event.adminId !== user.id) {
    throw new AppError('You do not have permission to manage this gallery', 403);
  }
  return gallery;
}

async function createGallery(req, res, next) {
  try {
    const { id: eventId } = req.params;
    const { pin } = req.body;

    if (!pin || !/^\d{4,8}$/.test(pin)) {
      throw new AppError('pin is required and must be 4-8 digits', 400);
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError('Event not found', 404);
    if (event.adminId !== req.user.id) {
      throw new AppError('You do not have permission to manage this event', 403);
    }

    const existing = await prisma.gallery.findUnique({ where: { eventId } });
    if (existing) throw new AppError('This event already has a gallery', 409);

    const pinHash = await bcrypt.hash(pin, 10);
    const slug = generateSlug();

    const gallery = await prisma.gallery.create({
      data: { eventId, slug, pinHash },
    });

    res.status(201).json({ id: gallery.id, slug: gallery.slug, published: gallery.published });
  } catch (err) {
    next(err);
  }
}

async function updateGalleryPhotos(req, res, next) {
  try {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) {
      throw new AppError('photoIds must be an array', 400);
    }

    const gallery = await getOwnedGallery(req.params.id, req.user);

    // every photoId must actually belong to this gallery's event
    const validPhotos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, eventId: gallery.eventId },
      select: { id: true },
    });
    if (validPhotos.length !== photoIds.length) {
      throw new AppError('One or more photoIds do not belong to this event', 400);
    }

    // atomic swap: clear old selection, insert new one
    await prisma.$transaction([
      prisma.galleryPhoto.deleteMany({ where: { galleryId: gallery.id } }),
      prisma.galleryPhoto.createMany({
        data: photoIds.map((photoId) => ({ galleryId: gallery.id, photoId })),
      }),
    ]);

    res.json({ galleryId: gallery.id, selectedCount: photoIds.length });
  } catch (err) {
    next(err);
  }
}
async function getGalleryByEvent(req, res, next) {
  try {
    const { id: eventId } = req.params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError('Event not found', 404);
    if (event.adminId !== req.user.id) {
      throw new AppError('You do not have permission to manage this event', 403);
    }

    const gallery = await prisma.gallery.findUnique({
      where: { eventId },
      include: { photos: { select: { photoId: true } } },
    });
    if (!gallery) throw new AppError('This event has no gallery yet', 404);

    res.json({
      id: gallery.id,
      slug: gallery.slug,
      published: gallery.published,
      photoIds: gallery.photos.map((p) => p.photoId),
    });
  } catch (err) {
    next(err);
  }
}

async function publishGallery(req, res, next) {
  try {
    const gallery = await getOwnedGallery(req.params.id, req.user);

    const photoCount = await prisma.galleryPhoto.count({ where: { galleryId: gallery.id } });
    if (photoCount === 0) {
      throw new AppError('Cannot publish a gallery with no selected photos', 400);
    }

    const updated = await prisma.gallery.update({
      where: { id: gallery.id },
      data: { published: true },
    });

    res.json({ slug: updated.slug, published: updated.published });
  } catch (err) {
    next(err);
  }
}

module.exports = { createGallery, updateGalleryPhotos, publishGallery, getGalleryByEvent };