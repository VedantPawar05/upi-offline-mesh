// ─────────────────────────────────────────
// AuditLog.js — Mongoose model
// Every rejected/invalid packet logged with reason.
// Fixes L-09: silent rejection loophole.
// ─────────────────────────────────────────
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    packetHash: {
      type: String,
      required: true,
    },
    outcome: {
      type: String,
      required: true,
      enum: ['REJECTED', 'INVALID'],
    },
    reason: {
      type: String,
      default: null,
    },
    senderVpa: {
      type: String,
      default: null, // May not be available if decryption failed
    },
    bridgeNodeId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
