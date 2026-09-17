const prisma = require('../config/prisma');
const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');
// Wraps Cloudinary's callback-based upload_stream in a Promise so we can use async/await
function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function uploadPhotos(req, res, next) {
  try {
    const { id: eventId } = req.params;

    // Only MEMBERs upload (enforced by route middleware too) — still confirm
    // this member is actually assigned to the event before accepting files.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { members: true },
    });
    if (!event) throw new AppError('Event not found', 404);

    const isMember = event.members.some((m) => m.userId === req.user.id);
    if (!isMember) throw new AppError('You do not have access to this event', 403);

    if (!req.files || req.files.length === 0) {
      throw new AppError('No files were uploaded', 400);
    }

    const uploadedPhotos = [];
    for (const file of req.files) {
      const result = await uploadBufferToCloudinary(file.buffer, `events/${eventId}`);

      const photo = await prisma.photo.create({
        data: {
          eventId,
          uploadedBy: req.user.id,
          filename: file.originalname,
          storageUrl: result.secure_url,
          publicId: result.public_id,
          fileSize: file.size,
        },
      });
      uploadedPhotos.push(photo);
    }

    res.status(201).json(uploadedPhotos);
  } catch (err) {
    next(err);
  }
}

async function getEventPhotos(req, res, next) {
  try {
    const { id: eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { members: true },
    });
    if (!event) throw new AppError('Event not found', 404);

    const hasAccess =
      req.user.role === 'ADMIN'
        ? event.adminId === req.user.id
        : event.members.some((m) => m.userId === req.user.id);
    if (!hasAccess) throw new AppError('You do not have access to this event', 403);

    // Admin sees every photo in the event; Member sees only their own uploads
    const where =
      req.user.role === 'ADMIN'
        ? { eventId }
        : { eventId, uploadedBy: req.user.id };

    const photos = await prisma.photo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Admin needs to know who uploaded each photo
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });

    res.json(photos);
  } catch (err) {
    next(err);
  }
}
async function deletePhoto(req, res, next) {
  try {
    const { photoId } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { event: true },
    });
    if (!photo) throw new AppError('Photo not found', 404);

    if (photo.event.adminId !== req.user.id) {
      throw new AppError('You do not have permission to manage this event', 403);
    }

    // Best-effort cloud cleanup — don't let a Cloudinary hiccup block the DB delete
    await cloudinary.uploader.destroy(photo.publicId).catch(() => {});

    // Postgres cascade (onDelete: Cascade on GalleryPhoto.photo) removes any
    // gallery-selection rows referencing this photo automatically.
    await prisma.photo.delete({ where: { id: photoId } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadPhotos, getEventPhotos, deletePhoto };