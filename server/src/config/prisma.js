const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Wrap $connect with one retry — smooths over transient network blips
async function connectWithRetry(retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      console.log(`DB connect attempt ${i + 1} failed, retrying...`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
connectWithRetry();

module.exports = prisma;