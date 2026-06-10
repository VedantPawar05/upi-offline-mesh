const Redis = require('ioredis');

async function createRedisClient(redisUrl, options = {}) {
  const client = new Redis(redisUrl, { ...options });

  client.on('error', (err) => {
    console.error('FATAL: Redis connection failed. Server cannot start without Redis.');
    process.exit(1);
  });

  return new Promise((resolve) => {
    client.once('ready', () => {
      resolve(client);
    });
  });
}

module.exports = { createRedisClient };
