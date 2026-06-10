// ─────────────────────────────────────────
// bridge.js — Authenticated bridge node routes
// POST /bridge/register (open) + POST /bridge/ingest (JWT + rate-limit + Zod)
// ─────────────────────────────────────────
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const BridgeNode = require('../models/BridgeNode');
const bridgeAuth = require('../middleware/bridgeAuth');
const { validateMeshPacket } = require('../middleware/inputValidator');
const bridgeIngestionService = require('../services/bridgeIngestionService');

// Rate limiter is injected by app.js after Redis is ready
let rateLimiter = null;
function setRateLimiter(limiter) {
  rateLimiter = limiter;
}

// ── POST /bridge/register ───────────────────────────
// Register a new bridge node — returns signed JWT.
router.post('/register', async (req, res) => {
  try {
    const { nodeId } = req.body;
    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim().length === 0) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    // Check if already registered
    let node = await BridgeNode.findOne({ nodeId }).select('+jwtSecret');
    let jwtSecret;

    if (node) {
      jwtSecret = node.jwtSecret;
    } else {
      jwtSecret = crypto.randomBytes(32).toString('hex');
      node = await BridgeNode.create({ nodeId, jwtSecret });
    }

    const token = jwt.sign({ nodeId: node.nodeId }, jwtSecret, { expiresIn: '30d' });

    res.status(201).json({
      nodeId: node.nodeId,
      jwt: token,
      expiresIn: '30d',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /bridge/ingest ─────────────────────────────
// THE production endpoint. Pipeline: JWT auth → Rate limit → Zod → Ingestion.
router.post(
  '/ingest',
  bridgeAuth,
  (req, res, next) => {
    // Apply rate limiter if available
    if (rateLimiter) return rateLimiter(req, res, next);
    next();
  },
  validateMeshPacket,
  async (req, res) => {
    try {
      const packet = req.body;
      const bridgeNodeId = req.bridgeNode.nodeId;

      // Read hopCount from the request header X-Hop-Count
      let hopCount = parseInt(req.header('X-Hop-Count'), 10);
      if (isNaN(hopCount)) {
        hopCount = 0;
      }

      const result = await bridgeIngestionService.ingest(packet, bridgeNodeId, hopCount);

      const statusCode =
        result.outcome === 'SETTLED' ? 200 :
        result.outcome === 'DUPLICATE_DROPPED' ? 200 :
        result.outcome === 'INVALID' ? 422 :
        result.outcome === 'REJECTED' ? 422 : 500;

      res.status(statusCode).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
module.exports.setRateLimiter = setRateLimiter;
