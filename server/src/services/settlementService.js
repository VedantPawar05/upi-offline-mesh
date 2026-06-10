// ─────────────────────────────────────────
// settlementService.js
// Mongoose session atomic transfer + PIN verification.
// Fallback for standalone MongoDB (non-replica sets).
// Fixes L-04 (PIN never verified).
// ─────────────────────────────────────────
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');

/**
 * Atomically settle a payment instruction.
 * Always requires MongoDB replica set for transactions.
 */
async function settle(instruction, packetHash, bridgeNodeId, hopCount) {
  const { senderVpa, receiverVpa, amountPaise, pinHash } = instruction;

  // Step 9: PIN verification (L-04 fix)
  const senderAccount = await Account.findById(senderVpa).select('+pinHash');
  if (!senderAccount) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'sender_not_found',
      senderVpa,
      bridgeNodeId,
    });
    return { outcome: 'INVALID', reason: 'sender_not_found' };
  }

  const pinValid = await bcrypt.compare(pinHash, senderAccount.pinHash);
  if (!pinValid) {
    await AuditLog.create({
      packetHash,
      outcome: 'INVALID',
      reason: 'invalid_pin',
      senderVpa,
      bridgeNodeId,
    });
    return { outcome: 'INVALID', reason: 'invalid_pin' };
  }

  const topologyType = mongoose.connection.client?.topology?.description?.type;
  const useTransaction = topologyType && topologyType !== 'Single';

  let session = null;
  if (useTransaction) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    // Re-fetch inside session if transactional consistency is enabled
    const sender = session
      ? await Account.findById(senderVpa).session(session)
      : await Account.findById(senderVpa);
    
    const receiver = session
      ? await Account.findById(receiverVpa).session(session)
      : await Account.findById(receiverVpa);

    if (!receiver) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      await AuditLog.create({
        packetHash,
        outcome: 'INVALID',
        reason: 'receiver_not_found',
        senderVpa,
        bridgeNodeId,
      });
      return { outcome: 'INVALID', reason: 'receiver_not_found' };
    }

    // Check balance
    if (sender.balancePaise < amountPaise) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      await AuditLog.create({
        packetHash,
        outcome: 'REJECTED',
        reason: 'insufficient_balance',
        senderVpa,
        bridgeNodeId,
      });
      return { outcome: 'REJECTED', reason: 'insufficient_balance' };
    }

    // Debit sender, credit receiver
    sender.balancePaise -= amountPaise;
    receiver.balancePaise += amountPaise;

    if (session) {
      await sender.save({ session });
      await receiver.save({ session });
    } else {
      await sender.save();
      await receiver.save();
    }

    // Write Transaction document
    const txData = {
      packetHash,
      senderVpa,
      receiverVpa,
      amountPaise,
      signedAt: new Date(instruction.signedAt),
      settledAt: new Date(),
      bridgeNodeId,
      hopCount,
      status: 'SETTLED',
    };

    const tx = session
      ? await Transaction.create([txData], { session })
      : await Transaction.create([txData]);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    return {
      outcome: 'SETTLED',
      transactionId: tx[0]._id.toString(),
      packetHash,
      senderVpa,
      receiverVpa,
      amountPaise,
      bridgeNodeId,
      hopCount,
      settledAt: tx[0].settledAt,
    };
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    
    if (err.message && err.message.includes('replSet')) {
      console.error('FATAL: MongoDB session failed. Ensure replica set is configured.');
    }
    
    return handleSettleError(err, packetHash, senderVpa, bridgeNodeId);
  }
}

function handleSettleError(err, packetHash, senderVpa, bridgeNodeId) {
  // Handle Mongoose VersionError (optimistic locking conflict)
  if (err.name === 'VersionError') {
    AuditLog.create({
      packetHash,
      outcome: 'REJECTED',
      reason: 'concurrent_conflict',
      senderVpa,
      bridgeNodeId,
    });
    return { outcome: 'REJECTED', reason: 'concurrent_conflict' };
  }

  // Handle duplicate key error (DB-level idempotency fallback)
  if (err.code === 11000) {
    return { outcome: 'DUPLICATE_DROPPED', reason: 'db_unique_constraint' };
  }

  throw err;
}

module.exports = { settle };
