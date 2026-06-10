// ─────────────────────────────────────────
// api.js — Public REST routes
// All endpoints except /bridge/ingest
// ─────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { publicKey } = require('../crypto/serverKeyHolder');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const meshSimulator = require('../services/meshSimulatorService');
const demoService = require('../services/demoService');
const bridgeIngestionService = require('../services/bridgeIngestionService');
const idempotencyService = require('../services/idempotencyService');
const { validateDemoSend } = require('../middleware/inputValidator');
const meshSocket = require('../socket/meshSocket');

// ── GET /api/server-key ─────────────────────────────
// Returns the RSA public key for client-side encryption.
router.get('/server-key', (req, res) => {
  const pubKeyBase64 = Buffer.from(publicKey).toString('base64');
  res.json({ publicKey: pubKeyBase64, algorithm: 'RSA-OAEP + AES-256-GCM' });
});

// ── GET /api/accounts ───────────────────────────────
// All demo accounts with current balances (pinHash excluded).
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions ───────────────────────────
// Last 20 settled/rejected transactions.
router.get('/transactions', async (req, res) => {
  try {
    const txs = await Transaction.find().sort({ settledAt: -1 }).limit(20);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit-log ──────────────────────────────
// Last 20 audit log entries (rejected/invalid packets).
router.get('/audit-log', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(20);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/mesh/state ─────────────────────────────
// Current packet count per virtual device.
router.get('/mesh/state', (req, res) => {
  const state = meshSimulator.getState();
  res.json(state);
});

// ── POST /api/demo/send ─────────────────────────────
// Simulate sender phone: encrypt PaymentInstruction, inject into mesh.
router.post('/demo/send', validateDemoSend, async (req, res) => {
  try {
    const { senderVpa, receiverVpa, amountPaise, pin, ttl } = req.body;

    // Create encrypted MeshPacket
    const packet = await demoService.createPacket(
      senderVpa,
      receiverVpa,
      amountPaise,
      pin,
      ttl
    );

    // Inject into alice's phone (sender)
    meshSimulator.inject('phone-alice', packet);

    const deviceCounts = meshSimulator.getDeviceCounts();
    meshSocket.emitMeshUpdate({ deviceCounts });

    res.json({
      message: 'Payment created and injected into mesh',
      packetId: packet.packetId,
      ttl: packet.ttl,
      deviceCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/mesh/gossip ───────────────────────────
// Run one round of gossip across all virtual devices.
router.post('/mesh/gossip', (req, res) => {
  try {
    const result = meshSimulator.gossipOnce();
    res.json({
      message: `Gossip round complete — ${result.transfers} transfers`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/mesh/flush ────────────────────────────
// Bridge nodes upload all held packets in parallel.
router.post('/mesh/flush', async (req, res) => {
  try {
    const uploads = meshSimulator.collectBridgeUploads();

    if (uploads.length === 0) {
      return res.json({ message: 'No packets to flush', results: [] });
    }

    // Process all uploads in parallel (exercises concurrent idempotency)
    const results = await Promise.all(
      uploads.map(({ packet, bridgeDeviceId }) =>
        bridgeIngestionService.ingest(packet, bridgeDeviceId, packet.ttl)
      )
    );

    // Refresh accounts after settlement
    const deviceCounts = meshSimulator.getDeviceCounts();
    meshSocket.emitMeshUpdate({ deviceCounts });

    res.json({
      message: `Flushed ${uploads.length} packets`,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/mesh/reset ────────────────────────────
// Clear all device queues + idempotency cache.
router.post('/mesh/reset', async (req, res) => {
  try {
    meshSimulator.reset();
    await idempotencyService.clearAll();

    const deviceCounts = meshSimulator.getDeviceCounts();
    meshSocket.emitMeshUpdate({ deviceCounts });

    res.json({
      message: 'Mesh and idempotency cache cleared',
      deviceCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
