import { Queue, QueueEvents } from 'bullmq';
import connection from './redis-connection.js';

export const QUEUE_NAME = 'content';

export const contentQueue = new Queue(QUEUE_NAME, { connection });
export const contentEvents = new QueueEvents(QUEUE_NAME, { connection });

function defaultOpts(extra = {}) {
  return {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
    ...extra,
  };
}

// Enfileira renderização
export async function enqueueContentRender(payload, opts = {}) {
  return contentQueue.add('render', payload, defaultOpts(opts));
}

// Enfileira transcrição
export async function enqueueTranscribe(payload, opts = {}) {
  return contentQueue.add('transcribe', payload, defaultOpts(opts));
}

export default { contentQueue, contentEvents, enqueueContentRender, enqueueTranscribe };
