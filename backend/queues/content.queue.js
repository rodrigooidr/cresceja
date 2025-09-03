// backend/queues/content.queue.js
import { Queue, QueueEvents } from 'bullmq';
import connection from './redis-connection.js';

export const contentQueue = new Queue('content', { connection });
export const contentEvents = new QueueEvents('content', { connection });

/**
 * Enfileira job de conteúdo (ex.: geração/repurpose/transcript-merge, etc.)
 * @param {string} name - nome do job (ex.: 'process', 'repurpose')
 * @param {object} payload - dados do job
 * @param {object} opts - opções BullMQ (attempts, backoff, delay, etc.)
 */
export async function enqueueContentJob(name, payload, opts = {}) {
  return contentQueue.add(
    name,
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

export default { contentQueue, contentEvents, enqueueContentJob };
