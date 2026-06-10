// ─────────────────────────────────────────
// Transaction.js — Mongoose model
// Settled/rejected transaction ledger.
// packetHash has unique index (DB-level idempotency fallback).
// ─────────────────────────────────────────
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    packetHash: {
      type: String,
      required: true,
      unique: true,
      minlength: 64,
      maxlength: 64,
      index: true,
    },
    senderVpa: {
      type: String,
      required: true,
    },
    receiverVpa: {
      type: String,
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (paise)',
      },
    },
    signedAt: {
      type: Date,
      required: true,
    },
    settledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    bridgeNodeId: {
      type: String,
      required: true,
    },
    hopCount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Hop count must be an integer',
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['SETTLED', 'REJECTED'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
