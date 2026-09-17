require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const suffix = Date.now();
const adminEmail = `admin_authz_${suffix}@test.com`;
const memberEmail = `member_authz_${suffix}@test.com`;

let adminToken, memberToken, eventId, otherEventId;

describe('Authorization (roles + event ownership)', () => {
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
        .send({ name: 'Authz Test Event' })
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
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await prisma.$disconnect();
  });

  it('blocks a MEMBER from creating an event', async () => {
    const res = await request(app).post('/api/events')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Sneaky Event' });
    expect(res.status).toBe(403);
  });

  it('allows a MEMBER to view an event they are assigned to', async () => {
    const res = await request(app).get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks a MEMBER from viewing an event they are NOT assigned to', async () => {
    const res = await request(app).get(`/api/events/${otherEventId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks a MEMBER from adding team members', async () => {
    const res = await request(app).post(`/api/events/${eventId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: memberEmail });
    expect(res.status).toBe(403);
  });

  it('blocks any request with no token at all', async () => {
    const res = await request(app).get(`/api/events/${eventId}`);
    expect(res.status).toBe(401);
  });
});