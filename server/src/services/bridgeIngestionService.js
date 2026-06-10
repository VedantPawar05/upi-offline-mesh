// ─────────────────────────────────────────
// bridgeIngestionService.js
// Full 11-step pipeline orchestrator (steps 4–11).
// Steps 1–3 are handled by middleware (bridgeAuth, rateLimiter, inputValidator).
// ─────────────────────────────────────────
const { decrypt, hashCiphertext } = require('../crypto/hybridCryptoService');
const idempotencyService = require('./idempotencyService');
const settlementService = require('./settlementService');
const AuditLog = require('../models/AuditLog');
const meshSocket = require('../socket/meshSocket');

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;        // 5 minutes

/**
 * Ingest a mesh packet through the full pipeline (steps 4–11).
 *
 * @param {Object} packet — { packetId, ttl, createdAt, ciphertext }
 * @param {string} bridgeNodeId — authenticated bridge node identity
 * @param {number} hopCount — how many mesh hops this packet took
 * @returns {Object} IngestResult { outcome, packetHash, reason?, transactionId? }
 */
async function ingest(packet, bridgeNodeId, hopCount = 0) {
  const { ciphertext, ttl } = packet;

  // ── Step 4: Hash the ciphertext ───────────────────
  const packetHash = hashCiphertext(ciphertext);

  // ── Step 5: Idempotency gate ──────────────────────
  const claimed = await idempotencyService.claim(packetHash);
  if (!claimed) {
    return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: 'duplicate' };
  }

  // ── Step 6: Decrypt + tamper check ────────────────
  let instruction;
  try {
    instruction = decrypt(ciphertext);
  } catch (err) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'tampered_or_corrupt',
      bridgeNodeId,
    });
    meshSocket.emitRejected({
      packetHash,
      outcome: 'INVALID',
      reason: 'tampered_or_corrupt',
      bridgeNodeId,
      timestamp: new Date(),
    });
    return { outcome: 'INVALID', packetHash, reason: 'tampered_or_corrupt' };
  }

  // ── Step 7: Freshness check ───────────────────────
  const now = Date.now();
  const signedAt = instruction.signedAt;

  if (now - signedAt > FRESHNESS_WINDOW_MS) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'stale_packet',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
    });
    meshSocket.emitRejected({
      packetHash,
      outcome: 'INVALID',
      reason: 'stale_packet',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
      timestamp: new Date(),
    });
    return { outcome: 'INVALID', packetHash, reason: 'stale_packet' };
  }

  if (signedAt - now > FUTURE_TOLERANCE_MS) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'future_dated',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
    });
    meshSocket.emitRejected({
      packetHash,
      outcome: 'INVALID',
      reason: 'future_dated',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
      timestamp: new Date(),
    });
    return { outcome: 'INVALID', packetHash, reason: 'future_dated' };
  }

  // ── Step 8: TTL integrity check (L-10 fix) ───────
  if (typeof instruction.ttlInner === 'number' && ttl > instruction.ttlInner) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'ttl_tampered',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
    });
    meshSocket.emitRejected({
      packetHash,
      outcome: 'INVALID',
      reason: 'ttl_tampered',
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
      timestamp: new Date(),
    });
    return { outcome: 'INVALID', packetHash, reason: 'ttl_tampered' };
  }

  // ── Steps 9–10: PIN verify + atomic settle ────────
  const result = await settlementService.settle(
    instruction,
    packetHash,
    bridgeNodeId,
    hopCount
  );

  // ── Step 11: Socket.io push ───────────────────────
  if (result.outcome === 'SETTLED') {
    meshSocket.emitSettled({
      transactionId: result.transactionId,
      senderVpa: instruction.senderVpa,
      receiverVpa: instruction.receiverVpa,
      amountPaise: instruction.amountPaise,
      bridgeNodeId,
      hopCount,
      settledAt: result.settledAt,
    });
  } else if (result.outcome === 'REJECTED' || result.outcome === 'INVALID') {
    meshSocket.emitRejected({
      packetHash,
      outcome: result.outcome,
      reason: result.reason,
      senderVpa: instruction.senderVpa,
      bridgeNodeId,
      timestamp: new Date(),
    });
  }

  return { ...result, packetHash };
}

module.exports = { ingest };
