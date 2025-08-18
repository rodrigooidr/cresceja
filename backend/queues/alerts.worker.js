import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedis } from '../config/redis.js';

const worker = new Worker('alerts', async job => {
  console.log('[alert]', job.name, job.data);
}, { connection: getRedis() });

console.log('Alerts worker running');

process.on('SIGINT', async () => { await worker.close(); process.exit(0); });
process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
