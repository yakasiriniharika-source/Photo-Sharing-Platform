require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const cloudinary = require('../src/config/cloudinary');
const testImage = require('./helpers/testImage');

const suffix = Date.now();
const adminEmail = `admin_gallery_${suffix}@test.com`;
const memberEmail = `member_gallery_${suffix}@test.com`;

let adminToken, memberToken, eventId, photoId;
const uploadedPublicIds = [];

describe('Gallery publishing workflow', () => {
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
        .send({ name: 'Gallery Test Event' })
    ).body.id;

    await request(app).post(`/api/events/${eventId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail });

    const uploadRes = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'gallery-test.jpg');
    photoId = uploadRes.body[0].id;
    uploadedPublicIds.push(uploadRes.body[0].publicId);
  });

  afterAll(async () => {
    for (const publicId of uploadedPublicIds) {
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await prisma.$disconnect();
  });

  let galleryId;

  it('blocks a MEMBER from creating a gallery', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/gallery`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ pin: '111111' });
    expect(res.status).toBe(403);
  });

  it('allows the owning ADMIN to create a gallery', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/gallery`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pin: '482917' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBeDefined();
    expect(res.body.pinHash).toBeUndefined(); // must never leak the hash
    galleryId = res.body.id;
  });

  it('rejects a photoId that does not belong to this event', async () => {
    const res = await request(app)
      .patch(`/api/galleries/${galleryId}/photos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photoIds: ['00000000-0000-0000-0000-000000000000'] });
    expect(res.status).toBe(400);
  });

  it('blocks publishing a gallery with zero selected photos', async () => {
    const res = await request(app)
      .post(`/api/galleries/${galleryId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('allows selecting a valid photo', async () => {
    const res = await request(app)
      .patch(`/api/galleries/${galleryId}/photos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photoIds: [photoId] });
    expect(res.status).toBe(200);
    expect(res.body.selectedCount).toBe(1);
  });

  it('publishes successfully once photos are selected', async () => {
    const res = await request(app)
      .post(`/api/galleries/${galleryId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(true);
  });
});