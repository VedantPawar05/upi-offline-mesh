// ─────────────────────────────────────────
// idempotencyService.js
// Redis SET NX EX — distributed atomic idempotency.
// Fixes L-02 (duplicate storm) and L-08 (single-instance).
// ─────────────────────────────────────────

let redis = null;

/**
 * Initialize the idempotency service with a Redis client.
 * @param {import('ioredis').Redis} redisClient
 */
function init(redisClient) {
  redis = redisClient;
}

/**
 * Attempt to claim a packet hash. Returns true if this is the first claimer.
 * Uses Redis SET NX EX 86400 — atomic, distributed, auto-expires after 24h.
 * @param {string} hash — SHA-256 hex of the ciphertext
 * @returns {Promise<boolean>} true if claimed (first), false if duplicate
 */
async function claim(hash) {
  if (!redis) throw new Error('IdempotencyService not initialized — call init(redis) first');
  const result = await redis.set(`idempotency:${hash}`, '1', 'NX', 'EX', 86400);
  return result === 'OK';
}

/**
 * Clear all idempotency keys — for testing/demo reset only.
 */
async function clearAll() {
  if (!redis) return;
  const keys = await redis.keys('idempotency:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

module.exports = { init, claim, clearAll };
