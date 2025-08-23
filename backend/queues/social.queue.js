const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
import pkg from 'bullmq';
const { Queue } = pkg;
import { getRedis } from '../config/redis.js';

const q = new Queue('social-publish', { connection: connection });

export async function enqueueSocialSend(payload) {
  return q.add('send', payload, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
}
