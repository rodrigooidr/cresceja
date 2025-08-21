import { Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';

const q = new Queue('content:transcribe', { connection: getRedis() });

export async function enqueueTranscribe(payload) {
  return q.add('transcribe', payload, { attempts: 3, backoff: { type: 'fixed', delay: 3000 } });
}
