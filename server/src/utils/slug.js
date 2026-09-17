const crypto = require('crypto');

function generateSlug() {
  return crypto.randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"
}

module.exports = { generateSlug };