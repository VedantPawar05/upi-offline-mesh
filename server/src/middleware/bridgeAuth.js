// ─────────────────────────────────────────
// bridgeAuth.js — JWT authentication middleware
// Fixes L-06: unverified bridge identity.
// Verifies Bearer token using per-node secret from BridgeNode model.
// ─────────────────────────────────────────
const jwt = require('jsonwebtoken');
const BridgeNode = require('../models/BridgeNode');

/**
 * Express middleware: verifies JWT Bearer token.
 * Attaches req.bridgeNode = { nodeId } on success.
 * Returns 401 if missing, expired, or invalid.
 */
async function bridgeAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Decode without verifying to extract nodeId
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.nodeId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Fetch per-node JWT secret from DB
    const node = await BridgeNode.findOne({ nodeId: decoded.nodeId }).select('+jwtSecret');
    if (!node) {
      return res.status(401).json({ error: 'Bridge node not registered' });
    }

    // Verify with per-node secret
    jwt.verify(token, node.jwtSecret);

    // Update lastSeenAt
    node.lastSeenAt = new Date();
    await node.save();

    // Attach bridge node info to request
    req.bridgeNode = { nodeId: node.nodeId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = bridgeAuth;
