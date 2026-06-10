// ─────────────────────────────────────────
// BridgeNode.js — Mongoose model
// Registered bridge nodes with per-node JWT secrets.
// ─────────────────────────────────────────
const mongoose = require('mongoose');

const bridgeNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    jwtSecret: {
      type: String,
      required: true,
      select: false, // Never returned in API responses
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('BridgeNode', bridgeNodeSchema);
