// backend/queues/repurpose.worker.js
import 'dotenv/config';
import pkg from 'bullmq';
const { Worker, Queue, QueueScheduler } = pkg;
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Exemplo básico de worker (ajuste conforme seu código real)
new Worker('repurpose:jobs', async job => {
  // faça o processamento necessário aqui
  return { ok: true };
}, { connection });

// Se você realmente usa Queue/QueueScheduler em outro arquivo, este import já resolve o CJS
console.log('[repurpose.worker] online');
