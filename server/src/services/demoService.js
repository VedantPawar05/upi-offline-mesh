// ─────────────────────────────────────────
// demoService.js
// Seeds demo accounts + creates encrypted MeshPackets.
// ─────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Account = require('../models/Account');
const BridgeNode = require('../models/BridgeNode');
const { encrypt } = require('../crypto/hybridCryptoService');
const { publicKey } = require('../crypto/serverKeyHolder');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Seed 4 demo accounts with bcrypt-hashed PINs.
 * Idempotent — skips if accounts already exist.
 */
async function seedAccounts() {
  const demoAccounts = [
    { _id: 'alice@demo', holderName: 'Alice Sharma', balancePaise: 1000000, pin: '1234' },
    { _id: 'bob@demo', holderName: 'Bob Patel', balancePaise: 500000, pin: '5678' },
    { _id: 'carol@demo', holderName: 'Carol Mehta', balancePaise: 750000, pin: '9012' },
    { _id: 'dave@demo', holderName: 'Dave Singh', balancePaise: 300000, pin: '3456' },
  ];

  for (const acct of demoAccounts) {
    const existing = await Account.findById(acct._id);
    if (!existing) {
      const pinHash = await bcrypt.hash(acct.pin, 10);
      await Account.create({
        _id: acct._id,
        holderName: acct.holderName,
        balancePaise: acct.balancePaise,
        pinHash,
      });
      console.log(`[Seed] Account created: ${acct._id} (₹${(acct.balancePaise / 100).toFixed(2)})`);
    }
  }
}

/**
 * Register the default bridge node.
 * Returns the existing JWT if already registered.
 * @returns {{ nodeId: string, jwt: string }}
 */
async function seedBridgeNode() {
  const nodeId = 'phone-bridge';
  let node = await BridgeNode.findOne({ nodeId }).select('+jwtSecret');

  if (!node) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    node = await BridgeNode.create({ nodeId, jwtSecret });
    console.log(`[Seed] Bridge node registered: ${nodeId}`);
  }

  const token = jwt.sign({ nodeId: node.nodeId }, node.jwtSecret, { expiresIn: '30d' });
  return { nodeId: node.nodeId, jwt: token };
}

/**
 * Create an encrypted MeshPacket simulating a sender phone.
 *
 * @param {string} senderVpa
 * @param {string} receiverVpa
 * @param {number} amountPaise — integer paise
 * @param {string} pin — raw PIN (will be hashed for comparison)
 * @param {number} [ttl=5]
 * @returns {Object} MeshPacket { packetId, ttl, createdAt, ciphertext }
 */
async function createPacket(senderVpa, receiverVpa, amountPaise, pin, ttl = 5) {
  // Pass the raw PIN (which is encrypted client-side and verified server-side with bcrypt.compare)
  const pinHash = pin;

  const instruction = {
    senderVpa,
    receiverVpa,
    amountPaise,
    pinHash,
    nonce: uuidv4(),
    signedAt: Date.now(),
    ttlInner: ttl,
  };

  const ciphertext = encrypt(instruction, publicKey);

  return {
    packetId: uuidv4(),
    amountPaise,
    ttl,
    createdAt: Date.now(),
    ciphertext,
  };
}

module.exports = { seedAccounts, seedBridgeNode, createPacket };
