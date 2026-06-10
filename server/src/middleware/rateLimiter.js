// ─────────────────────────────────────────
// rateLimiter.js — express-rate-limit + Redis store
// Fixes L-05: no rate limiting.
// 100 req/60s per bridgeNodeId.
// ─────────────────────────────────────────
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

let limiter = null;

/**
 * Create the rate limiter middleware with a Redis client.
 * @param {import('ioredis').Redis} redisClient
 * @returns {Function} Express middleware
 */
function createRateLimiter(redisClient) {
  limiter = rateLimit({
    windowMs: 60 * 1000, // 60 seconds
    max: 100,            // 100 requests per window per key
    standardHeaders: true,
    legacyHeaders: false,
    // Key by bridgeNodeId (set by bridgeAuth middleware)
    keyGenerator: (req) => {
      return req.bridgeNode ? req.bridgeNode.nodeId : req.ip;
    },
    // Redis store for distributed rate limiting
    store: redisClient.isMock ? undefined : new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'ratelimit:',
    }),
    message: {
      error: 'Rate limit exceeded',
      retryAfterMs: 60000,
    },
  });

  return limiter;
}

module.exports = { createRateLimiter };
