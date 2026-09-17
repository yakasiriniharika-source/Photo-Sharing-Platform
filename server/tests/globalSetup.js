require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  const prisma = new PrismaClient();
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`; // simplest possible query, just to wake the DB
      console.log(`Database reachable (attempt ${attempt})`);
      await prisma.$disconnect();
      return;
    } catch (err) {
      console.log(`DB not ready yet (attempt ${attempt}/${maxAttempts}), retrying in 3s...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  await prisma.$disconnect();
  throw new Error('Database did not become reachable after multiple attempts');
};