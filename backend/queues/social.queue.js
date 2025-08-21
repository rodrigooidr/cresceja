import { Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';

const q = new Queue('social:publish', { connection: getRedis() });

export async function enqueueSocialSend(payload) {
  return q.add('send', payload, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
}
