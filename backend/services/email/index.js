import pkg from 'bullmq';
const { Queue } = pkg;
import { redis as connection } from '../../config/redis.js';
import ses from './providers/ses.js';

const providers = { ses };

export function getProvider(name = 'ses') {
  return providers[name] || ses;
}

export const emailQueue = new Queue('email-send', { connection });

export async function enqueue(data) {
  return emailQueue.add('send', data, {
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

export default { getProvider, enqueue };
