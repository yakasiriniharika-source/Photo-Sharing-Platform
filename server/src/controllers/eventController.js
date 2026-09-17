const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const cloudinary = require('../config/cloudinary');
// Shared helper: fetch an event and verify req.user can access it.
// Throws if not found or not authorized. Returns the event if allowed.
async function getAccessibleEvent(eventId, user) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { members: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (user.role === 'ADMIN') {
    if (event.adminId !== user.id) {
      throw new AppError('You do not have access to this event', 403);
    }
  } else {
    const isMember = event.members.some((m) => m.userId === user.id);
    if (!isMember) {
      throw new AppError('You do not have access to this event', 403);
    }
  }

  return event;
}

async function createEvent(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) throw new AppError('Event name is required', 400);

    const event = await prisma.event.create({
      data: { name, adminId: req.user.id },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

async function getEvents(req, res, next) {
  try {
    let events;
    if (req.user.role === 'ADMIN') {
      events = await prisma.event.findMany({
        where: { adminId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      events = await prisma.event.findMany({
        where: { members: { some: { userId: req.user.id } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function getEventById(req, res, next) {
  try {
    const event = await getAccessibleEvent(req.params.id, req.user);
    res.json(event);
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('email is required', 400);

    // must own the event to add members to it
    const event = await getAccessibleEvent(req.params.id, req.user);
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Only the event Admin can add members', 403);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('No registered user with that email', 404);
    if (user.role !== 'MEMBER') throw new AppError('Only MEMBER accounts can be added as team members', 400);

    const existing = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    if (existing) throw new AppError('User is already a member of this event', 409);

    const member = await prisma.eventMember.create({
      data: { eventId: event.id, userId: user.id },
    });

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

async function getMembers(req, res, next) {
  try {
    const event = await getAccessibleEvent(req.params.id, req.user);
    const members = await prisma.eventMember.findMany({
      where: { eventId: event.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(members);
  } catch (err) {
    next(err);
  }
}
async function updateEvent(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) throw new AppError('Event name is required', 400);

    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError('Event not found', 404);
    if (event.adminId !== req.user.id) {
      throw new AppError('You do not have permission to manage this event', 403);
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: { name },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError('Event not found', 404);
    if (event.adminId !== req.user.id) {
      throw new AppError('You do not have permission to manage this event', 403);
    }

    // clean up Cloudinary BEFORE deleting the DB rows that reference them
    const photos = await prisma.photo.findMany({ where: { eventId: event.id } });
    for (const photo of photos) {
      await cloudinary.uploader.destroy(photo.publicId).catch(() => {});
      // .catch(() => {}) — don't let one failed Cloudinary cleanup block the whole deletion
    }

    await prisma.event.delete({ where: { id: event.id } });
    // Postgres cascade automatically removes EventMember, Photo, Gallery, GalleryPhoto rows

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { createEvent, getEvents, getEventById, addMember, getMembers, updateEvent, deleteEvent };

