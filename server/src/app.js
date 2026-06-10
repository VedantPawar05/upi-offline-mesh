// ─────────────────────────────────────────
// app.js — Express bootstrap
// MongoDB + Redis + Socket.io + route mounting
// ─────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { createRedisClient } = require('./utils/redisClient');
const { Server: SocketIOServer } = require('socket.io');

// Services
const idempotencyService = require('./services/idempotencyService');
const meshSimulator = require('./services/meshSimulatorService');
const demoService = require('./services/demoService');
const meshSocket = require('./socket/meshSocket');

// Middleware
const { createRateLimiter } = require('./middleware/rateLimiter');

// Routes
const apiRoutes = require('./routes/api');
const bridgeRoutes = require('./routes/bridge');

const app = express();
const server = http.createServer(app);

// ── Express middleware ──────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Socket.io ───────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});
meshSocket.init(io);

// ── Routes ──────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api/bridge', bridgeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Startup ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upi-mesh';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

async function start() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('[MongoDB] Connected');

    // 2. Connect to Redis
    const redis = await createRedisClient(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    if (!redis.isMock) {
      redis.on('connect', () => console.log('[Redis] Connected'));
      redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    }

    // 3. Initialize services with Redis
    idempotencyService.init(redis);

    // 4. Set up rate limiter with Redis
    const rateLimiter = createRateLimiter(redis);
    bridgeRoutes.setRateLimiter(rateLimiter);

    // 5. Seed mesh simulator devices
    meshSimulator.seedDevices();

    // 6. Seed demo accounts + bridge node
    await demoService.seedAccounts();
    const bridge = await demoService.seedBridgeNode();
    console.log(`[Seed] Default bridge JWT: ${bridge.jwt.substring(0, 20)}...`);

    // 7. Start server
    server.listen(PORT, () => {
      console.log(`\n🚀 UPI Offline Mesh server running on http://localhost:${PORT}`);
      console.log(`   MongoDB: ${MONGODB_URI}`);
      console.log(`   Redis:   ${REDIS_URL}`);
      console.log(`   Socket.io: ready\n`);
    });
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Closing connections...');
  await mongoose.disconnect();
  process.exit(0);
});

start();

module.exports = { app, server };
