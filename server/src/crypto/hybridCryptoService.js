// ─────────────────────────────────────────
// hybridCryptoService.js
// Hybrid RSA-OAEP + AES-256-GCM encryption.
// Wire format: [256B RSA-enc AES key][12B GCM IV][AES ciphertext][16B GCM tag]
// Uses node:crypto ONLY — no external crypto libraries.
// ─────────────────────────────────────────
const crypto = require('crypto');
const { privateKey } = require('./serverKeyHolder');

const RSA_KEY_LENGTH = 256; // 2048-bit RSA → 256-byte output
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

/**
 * Encrypt a PaymentInstruction object using hybrid encryption.
 * @param {Object} instruction — plain PaymentInstruction object
 * @param {string} publicKeyPem — RSA public key in PEM format
 * @returns {string} Base64-encoded ciphertext
 */
function encrypt(instruction, publicKeyPem) {
  const payload = Buffer.from(JSON.stringify(instruction), 'utf8');

  // 1. Generate fresh AES-256 key + random IV
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(GCM_IV_LENGTH);

  // 2. AES-256-GCM encrypt the payload
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ct = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // 3. RSA-OAEP wrap the AES key
  const encAesKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      oaepHash: 'sha256',
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    aesKey
  );

  // 4. Concatenate: [256B RSA key][12B IV][ciphertext][16B tag]
  const wire = Buffer.concat([encAesKey, iv, ct, tag]);
  return wire.toString('base64');
}

/**
 * Decrypt a Base64-encoded ciphertext back to PaymentInstruction.
 * Any tampering throws — GCM auth tag verification fails.
 * @param {string} ciphertext64 — Base64-encoded wire-format blob
 * @returns {Object} Decrypted PaymentInstruction
 */
function decrypt(ciphertext64) {
  const wire = Buffer.from(ciphertext64, 'base64');

  // 1. Slice out the components
  const encAesKey = wire.subarray(0, RSA_KEY_LENGTH);
  const iv = wire.subarray(RSA_KEY_LENGTH, RSA_KEY_LENGTH + GCM_IV_LENGTH);
  const tagStart = wire.length - GCM_TAG_LENGTH;
  const ct = wire.subarray(RSA_KEY_LENGTH + GCM_IV_LENGTH, tagStart);
  const tag = wire.subarray(tagStart);

  // 2. RSA-OAEP unwrap the AES key
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      oaepHash: 'sha256',
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    encAesKey
  );

  // 3. AES-256-GCM decrypt — setAuthTag BEFORE final()
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);

  return JSON.parse(plaintext.toString('utf8'));
}

/**
 * SHA-256 hash of the raw ciphertext (Base64 string).
 * Used as the idempotency key — identical ciphertexts produce identical hashes.
 * @param {string} ciphertext64 — Base64-encoded ciphertext
 * @returns {string} Hex-encoded SHA-256 hash (64 chars)
 */
function hashCiphertext(ciphertext64) {
  return crypto.createHash('sha256').update(ciphertext64).digest('hex');
}

module.exports = { encrypt, decrypt, hashCiphertext };
