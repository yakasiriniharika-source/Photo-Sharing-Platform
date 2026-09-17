require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const cloudinary = require('../src/config/cloudinary');
const testImage = require('./helpers/testImage');

const suffix = Date.now();
const adminEmail = `admin_public_${suffix}@test.com`;
const memberEmail = `member_public_${suffix}@test.com`;
const PIN = '482917';

let adminToken, memberToken, eventId, gallerySlug, unpublishedSlug;
const uploadedPublicIds = [];

describe('PIN-protected public gallery access', () => {
  beforeAll(async () => {
    adminToken = (
      await request(app).post('/api/auth/register')
        .send({ email: adminEmail, password: 'password123', name: 'Admin', role: 'ADMIN' })
    ).body.token;

    memberToken = (
      await request(app).post('/api/auth/register')
        .send({ email: memberEmail, password: 'password123', name: 'Member', role: 'MEMBER' })
    ).body.token;

    eventId = (
      await request(app).post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Public Test Event' })
    ).body.id;

    await request(app).post(`/api/events/${eventId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail });

    const uploadRes = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'public-test.jpg');
    const photoId = uploadRes.body[0].id;
    uploadedPublicIds.push(uploadRes.body[0].publicId);

    const galleryRes = await request(app)
      .post(`/api/events/${eventId}/gallery`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pin: PIN });
    const galleryId = galleryRes.body.id;
    gallerySlug = galleryRes.body.slug;

    await request(app)
      .patch(`/api/galleries/${galleryId}/photos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photoIds: [photoId] });

    await request(app)
      .post(`/api/galleries/${galleryId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    // a second gallery, deliberately left unpublished
    const unpublishedEventId = (
      await request(app).post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unpublished Event' })
    ).body.id;
    const unpublishedGalleryRes = await request(app)
      .post(`/api/events/${unpublishedEventId}/gallery`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pin: '111111' });
    unpublishedSlug = unpublishedGalleryRes.body.slug;
  });

  afterAll(async () => {
    for (const publicId of uploadedPublicIds) {
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await prisma.$disconnect();
  });

  it('returns event info for a published gallery, no auth required', async () => {
    const res = await request(app).get(`/api/public/galleries/${gallerySlug}`);
    expect(res.status).toBe(200);
    expect(res.body.eventName).toBe('Public Test Event');
  });

  it('hides an unpublished gallery as if it does not exist', async () => {
    const res = await request(app).get(`/api/public/galleries/${unpublishedSlug}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a slug that never existed, with the same message', async () => {
    const res = await request(app).get('/api/public/galleries/totally-fake-slug');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Gallery not found');
  });

  it('rejects an incorrect PIN', async () => {
    const res = await request(app)
      .post(`/api/public/galleries/${gallerySlug}/verify-pin`)
      .send({ pin: '000000' });
    expect(res.status).toBe(401);
  });

  it('accepts the correct PIN and returns photos + access token', async () => {
    const res = await request(app)
      .post(`/api/public/galleries/${gallerySlug}/verify-pin`)
      .send({ pin: PIN });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.photos.length).toBe(1);
  });

  it('allows re-fetching photos with a valid access token', async () => {
    const verifyRes = await request(app)
      .post(`/api/public/galleries/${gallerySlug}/verify-pin`)
      .send({ pin: PIN });
    const token = verifyRes.body.accessToken;

    const res = await request(app)
      .get(`/api/public/galleries/${gallerySlug}/photos`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.photos.length).toBe(1);
  });

  it('rejects a request to gallery photos with no token', async () => {
    const res = await request(app).get(`/api/public/galleries/${gallerySlug}/photos`);
    expect(res.status).toBe(401);
  });
});