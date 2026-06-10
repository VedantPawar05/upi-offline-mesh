// ─────────────────────────────────────────
// serverKeyHolder.js
// Generates RSA-2048 keypair on startup.
// Keys regenerate every server restart (demo only).
// ─────────────────────────────────────────
const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

console.log('[KeyHolder] RSA-2048 keypair generated');

module.exports = { publicKey, privateKey };
