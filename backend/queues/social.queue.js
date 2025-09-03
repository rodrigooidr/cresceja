// backend/queues/social.queue.js
import { Queue, QueueEvents } from 'bullmq';
import connection from './redis-connection.js';

export const socialQueue = new Queue('social', { connection });
export const socialEvents = new QueueEvents('social', { connection });

export async function enqueueSocialSend(payload, opts = {}) {
  return socialQueue.add(
    'send',
    payload,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
      ...opts,
    }
  );
}

export default { socialQueue, socialEvents, enqueueSocialSend };
