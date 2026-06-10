// ─────────────────────────────────────────
// pipeline.test.js
// Full pipeline integration tests
// AC-05 to AC-09
// ─────────────────────────────────────────
const mongoose = require('mongoose');
const { createRedisClient } = require('../src/utils/redisClient');
const bcrypt = require('bcryptjs');
const { encrypt } = require('../src/crypto/hybridCryptoService');
const { publicKey } = require('../src/crypto/serverKeyHolder');
const idempotencyService = require('../src/services/idempotencyService');
const bridgeIngestionService = require('../src/services/bridgeIngestionService');
const Account = require('../src/models/Account');
const Transaction = require('../src/models/Transaction');
const AuditLog = require('../src/models/AuditLog');
const BridgeNode = require('../src/models/BridgeNode');

let redis;

beforeAll(async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upi-mesh-test-pipeline';
  await mongoose.connect(mongoUri);

  redis = await createRedisClient(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    db: 2, // Use DB 2 for pipeline tests
  });
  idempotencyService.init(redis);

  // Clean
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await AuditLog.deleteMany({});
  await BridgeNode.deleteMany({});
  await idempotencyService.clearAll();

  // Seed test accounts
  const alicePin = await bcrypt.hash('1234', 10);
  const bobPin = await bcrypt.hash('5678', 10);

  await Account.create({ _id: 'alice@pipeline', holderName: 'Alice', balancePaise: 100000, pinHash: alicePin });
  await Account.create({ _id: 'bob@pipeline', holderName: 'Bob', balancePaise: 50000, pinHash: bobPin });
  await Account.create({ _id: 'broke@pipeline', holderName: 'Broke', balancePaise: 100, pinHash: alicePin });
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

// Helper to create a packet with custom options
async function makePacket(overrides = {}) {
  const pin = overrides.pin || '1234';
  const pinHash = pin;

  const instruction = {
    senderVpa: overrides.senderVpa || 'alice@pipeline',
    receiverVpa: overrides.receiverVpa || 'bob@pipeline',
    amountPaise: overrides.amountPaise || 10000,
    pinHash,
    nonce: `nonce-${Date.now()}-${Math.random()}`,
    signedAt: overrides.signedAt || Date.now(),
    ttlInner: overrides.ttlInner ?? 5,
  };

  const ciphertext = encrypt(instruction, publicKey);

  return {
    packetId: `pkt-${Date.now()}-${Math.random()}`,
    amountPaise: overrides.amountPaise || 10000,
    ttl: overrides.outerTtl ?? instruction.ttlInner,
    createdAt: Date.now(),
    ciphertext,
  };
}

describe('Pipeline Tests', () => {
  // AC-05: signedAt > 24h → INVALID (stale_packet)
  test('AC-05: stale packet (signedAt > 24h ago) returns INVALID stale_packet', async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const packet = await makePacket({ signedAt: staleTime });

    const result = await bridgeIngestionService.ingest(packet, 'bridge-test', 0);

    expect(result.outcome).toBe('INVALID');
    expect(result.reason).toBe('stale_packet');
  });

  // AC-06: outer TTL > inner TTL → INVALID (ttl_tampered)
  test('AC-06: outer TTL > inner TTL returns INVALID ttl_tampered', async () => {
    const packet = await makePacket({ ttlInner: 3, outerTtl: 7 });

    const result = await bridgeIngestionService.ingest(packet, 'bridge-test', 0);

    expect(result.outcome).toBe('INVALID');
    expect(result.reason).toBe('ttl_tampered');
  });

  // AC-07: wrong PIN → INVALID (invalid_pin), zero balance change
  test('AC-07: wrong PIN returns INVALID invalid_pin', async () => {
    const aliceBefore = await Account.findById('alice@pipeline');
    const bobBefore = await Account.findById('bob@pipeline');

    const packet = await makePacket({ pin: '9999' }); // Wrong PIN

    const result = await bridgeIngestionService.ingest(packet, 'bridge-test', 0);

    expect(result.outcome).toBe('INVALID');
    expect(result.reason).toBe('invalid_pin');

    // Verify no balance change
    const aliceAfter = await Account.findById('alice@pipeline');
    const bobAfter = await Account.findById('bob@pipeline');

    expect(aliceAfter.balancePaise).toBe(aliceBefore.balancePaise);
    expect(bobAfter.balancePaise).toBe(bobBefore.balancePaise);
  });

  // AC-09 (partial): insufficient balance returns REJECTED
  test('Insufficient balance returns REJECTED', async () => {
    const packet = await makePacket({
      senderVpa: 'broke@pipeline',
      amountPaise: 50000, // ₹500 but only ₹1 in account
    });

    const result = await bridgeIngestionService.ingest(packet, 'bridge-test', 0);

    expect(result.outcome).toBe('REJECTED');
    expect(result.reason).toBe('insufficient_balance');

    // Verify AuditLog was created
    const log = await AuditLog.findOne({ reason: 'insufficient_balance' });
    expect(log).toBeTruthy();
    expect(log.senderVpa).toBe('broke@pipeline');
  });

  // Valid settlement succeeds
  test('Valid payment settles correctly', async () => {
    const aliceBefore = await Account.findById('alice@pipeline');

    const packet = await makePacket({ amountPaise: 5000 }); // ₹50

    const result = await bridgeIngestionService.ingest(packet, 'bridge-test', 0);

    expect(result.outcome).toBe('SETTLED');
    expect(result.transactionId).toBeTruthy();

    const aliceAfter = await Account.findById('alice@pipeline');
    const bobAfter = await Account.findById('bob@pipeline');

    expect(aliceAfter.balancePaise).toBe(aliceBefore.balancePaise - 5000);
  });
});
