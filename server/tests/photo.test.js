require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const cloudinary = require('../src/config/cloudinary');
const testImage = require('./helpers/testImage');

const suffix = Date.now();
const adminEmail = `admin_photo_${suffix}@test.com`;
const memberEmail = `member_photo_${suffix}@test.com`;

let adminToken, memberToken, eventId, otherEventId;
const uploadedPublicIds = []; // track for Cloudinary cleanup

describe('Photo access controls', () => {
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
        .send({ name: 'Photo Test Event' })
    ).body.id;

    otherEventId = (
      await request(app).post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unrelated Event' })
    ).body.id;

    await request(app).post(`/api/events/${eventId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail });
  });

  afterAll(async () => {
    // clean up Cloudinary assets created during these tests
    for (const publicId of uploadedPublicIds) {
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await prisma.$disconnect();
  });

  it('allows an assigned MEMBER to upload a photo', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'test.jpg');

    expect(res.status).toBe(201);
    expect(res.body[0].storageUrl).toContain('cloudinary.com');
    uploadedPublicIds.push(res.body[0].publicId);
  });

  it('blocks a MEMBER from uploading to an event they are NOT assigned to', async () => {
    const res = await request(app)
      .post(`/api/events/${otherEventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'test.jpg');

    expect(res.status).toBe(403);
  });

  it('rejects a non-image file type', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', Buffer.from('not an image'), 'notes.txt');

    expect(res.status).toBe(400);
  });

  it('blocks a MEMBER from deleting a photo', async () => {
    const uploadRes = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'test2.jpg');
    const photoId = uploadRes.body[0].id;
    uploadedPublicIds.push(uploadRes.body[0].publicId);

    const res = await request(app)
      .delete(`/api/photos/${photoId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('allows the owning ADMIN to delete a photo', async () => {
    const uploadRes = await request(app)
      .post(`/api/events/${eventId}/photos`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photos', testImage, 'test3.jpg');
    const photoId = uploadRes.body[0].id;

    const res = await request(app)
      .delete(`/api/photos/${photoId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});