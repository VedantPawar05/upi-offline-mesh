// ─────────────────────────────────────────
// meshSocket.js
// Socket.io event emitter — tx:settled, tx:rejected, mesh:update.
// Fixes L-09: silent rejection loophole.
// ─────────────────────────────────────────

let io = null;

/**
 * Initialize with the Socket.io server instance.
 * @param {import('socket.io').Server} socketIo
 */
function init(socketIo) {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Emit a settlement event to all connected clients.
 * @param {Object} txData — { transactionId, senderVpa, receiverVpa, amountPaise, bridgeNodeId, hopCount, settledAt }
 */
function emitSettled(txData) {
  if (io) io.emit('tx:settled', txData);
}

/**
 * Emit a rejection event to all connected clients.
 * @param {Object} auditData — { packetHash, outcome, reason, senderVpa?, bridgeNodeId, timestamp }
 */
function emitRejected(auditData) {
  if (io) io.emit('tx:rejected', auditData);
}

/**
 * Emit mesh state update after gossip/flush.
 * @param {Object} data — { deviceCounts }
 */
function emitMeshUpdate(data) {
  if (io) io.emit('mesh:update', data);
}

module.exports = { init, emitSettled, emitRejected, emitMeshUpdate };
