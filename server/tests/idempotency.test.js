// ─────────────────────────────────────────
// idempotency.test.js
// AC-03: 3 concurrent ingest → 1 SETTLED, 2 DUPLICATE_DROPPED
// AC-04: sender balance decremented exactly once
// ─────────────────────────────────────────
const mongoose = require('mongoose');
const { createRedisClient } = require('../src/utils/redisClient');
const bcrypt = require('bcryptjs');
const { encrypt, hashCiphertext } = require('../src/crypto/hybridCryptoService');
const { publicKey } = require('../src/crypto/serverKeyHolder');
const idempotencyService = require('../src/services/idempotencyService');
const bridgeIngestionService = require('../src/services/bridgeIngestionService');
const Account = require('../src/models/Account');
const Transaction = require('../src/models/Transaction');
const AuditLog = require('../src/models/AuditLog');
const BridgeNode = require('../src/models/BridgeNode');

let redis;

beforeAll(async () => {
  // Connect to test MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upi-mesh-test';
  await mongoose.connect(mongoUri);

  // Connect to test Redis
  redis = await createRedisClient(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    db: 1, // Use DB 1 for tests
  });
  idempotencyService.init(redis);

  // Clean test data
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await AuditLog.deleteMany({});
  await BridgeNode.deleteMany({});
  await idempotencyService.clearAll();

  // Seed test accounts
  const alicePin = await bcrypt.hash('1234', 10);
  const bobPin = await bcrypt.hash('5678', 10);

  await Account.create({ _id: 'alice@test', holderName: 'Alice', balancePaise: 100000, pinHash: alicePin });
  await Account.create({ _id: 'bob@test', holderName: 'Bob', balancePaise: 50000, pinHash: bobPin });
});

afterAll(async () => {
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await AuditLog.deleteMany({});
  await BridgeNode.deleteMany({});
  await idempotencyService.clearAll();
  await redis.quit();
  await mongoose.disconnect();
});

describe('Idempotency Tests', () => {
  // AC-03: Promise.all with 3 concurrent ingest() → exactly 1 SETTLED, 2 DUPLICATE_DROPPED
  test('AC-03: 3 concurrent ingest of same packet → 1 SETTLED, 2 DUPLICATE_DROPPED', async () => {
    // Create a single encrypted packet
    const pinHash = '1234';
    const instruction = {
      senderVpa: 'alice@test',
      receiverVpa: 'bob@test',
      amountPaise: 10000, // ₹100
      pinHash,
      nonce: 'test-nonce-001',
      signedAt: Date.now(),
      ttlInner: 5,
    };

    const ciphertext = encrypt(instruction, publicKey);
    const packet = {
      packetId: 'test-packet-001',
      amountPaise: 10000, // ₹100
      ttl: 5,
      createdAt: Date.now(),
      ciphertext,
    };

    // 3 concurrent ingestion calls — simulating 3 bridge nodes
    const results = await Promise.all([
      bridgeIngestionService.ingest(packet, 'bridge-1', 2),
      bridgeIngestionService.ingest(packet, 'bridge-2', 3),
      bridgeIngestionService.ingest(packet, 'bridge-3', 1),
    ]);

    const settled = results.filter((r) => r.outcome === 'SETTLED');
    const duplicates = results.filter((r) => r.outcome === 'DUPLICATE_DROPPED');

    expect(settled).toHaveLength(1);
    expect(duplicates).toHaveLength(2);
  });

  // AC-04: Sender balance decremented by amountPaise exactly once
  test('AC-04: sender balance decremented exactly once after concurrent test', async () => {
    const alice = await Account.findById('alice@test');
    // Original: 100000, should be 100000 - 10000 = 90000
    expect(alice.balancePaise).toBe(90000);

    const bob = await Account.findById('bob@test');
    // Original: 50000, should be 50000 + 10000 = 60000
    expect(bob.balancePaise).toBe(60000);
  });
});
