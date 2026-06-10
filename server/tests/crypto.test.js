// ─────────────────────────────────────────
// crypto.test.js
// Tests: AC-01 (roundtrip), AC-02 (tamper), hash consistency
// ─────────────────────────────────────────
const { encrypt, decrypt, hashCiphertext } = require('../src/crypto/hybridCryptoService');
const { publicKey } = require('../src/crypto/serverKeyHolder');

describe('Hybrid Crypto Service', () => {
  const instruction = {
    senderVpa: 'alice@demo',
    receiverVpa: 'bob@demo',
    amountPaise: 50000,
    pinHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    nonce: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    signedAt: Date.now(),
    ttlInner: 5,
  };

  let ciphertext;

  beforeAll(() => {
    ciphertext = encrypt(instruction, publicKey);
  });

  // AC-01: encrypt-decrypt roundtrip preserves all PaymentInstruction fields
  test('AC-01: encrypt → decrypt roundtrip preserves all fields', () => {
    const decrypted = decrypt(ciphertext);

    expect(decrypted.senderVpa).toBe(instruction.senderVpa);
    expect(decrypted.receiverVpa).toBe(instruction.receiverVpa);
    expect(decrypted.amountPaise).toBe(instruction.amountPaise);
    expect(decrypted.pinHash).toBe(instruction.pinHash);
    expect(decrypted.nonce).toBe(instruction.nonce);
    expect(decrypted.signedAt).toBe(instruction.signedAt);
    expect(decrypted.ttlInner).toBe(instruction.ttlInner);
  });

  // AC-02: single bit flip in ciphertext causes decrypt to throw
  test('AC-02: single bit flip in ciphertext → decrypt throws', () => {
    const wire = Buffer.from(ciphertext, 'base64');

    // Flip a byte in the AES ciphertext region (after RSA key + IV)
    const flipIndex = 256 + 12 + 10; // inside ciphertext body
    wire[flipIndex] ^= 0x01;

    const tampered = wire.toString('base64');

    expect(() => decrypt(tampered)).toThrow();
  });

  // Hash consistency: same ciphertext → identical SHA-256 hash
  test('SHA-256 hash of same ciphertext is always identical', () => {
    const hash1 = hashCiphertext(ciphertext);
    const hash2 = hashCiphertext(ciphertext);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  // Different encryptions of the same instruction produce different ciphertexts
  test('two encryptions of same instruction produce different ciphertexts', () => {
    const ct2 = encrypt(instruction, publicKey);
    expect(ct2).not.toBe(ciphertext);

    // But both decrypt to the same instruction
    const dec2 = decrypt(ct2);
    expect(dec2.senderVpa).toBe(instruction.senderVpa);
    expect(dec2.amountPaise).toBe(instruction.amountPaise);
  });

  // Hash of different ciphertexts are different
  test('different ciphertexts produce different hashes', () => {
    const ct2 = encrypt(instruction, publicKey);
    expect(hashCiphertext(ciphertext)).not.toBe(hashCiphertext(ct2));
  });
});
