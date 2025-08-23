const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
import pkg from 'bullmq';
const { Queue } = pkg;
import { getRedis } from '../config/redis.js';

const q = new Queue('content-transcribe', { connection: connection });

export async function enqueueTranscribe(payload) {
  return q.add('transcribe', payload, { attempts: 3, backoff: { type: 'fixed', delay: 3000 } });
}
