// backend/queues/redis-connection.js
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  console.error('[redis] connection error:', err?.message || err);
});

export default connection;
