// backend/queues/content.worker.js
import 'dotenv/config';
import { Queue, Worker } from 'bullmq'; // BullMQ v4/v5 dispensam QueueScheduler
import connection from './redis-connection.js';
import pg from 'pg';

const {
  DATABASE_URL,
  CONTENT_RENDER_CONCURRENCY = '2',
  CONTENT_RENDER_ATTEMPTS = '3',
  CONTENT_RENDER_BACKOFF_MS = '2000',
} = process.env;

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

const QUEUE_NAME = 'content:render';

// Fila para enfileirar jobs (pode ser usada via CLI/local ou por outros módulos)
export const queue = new Queue(QUEUE_NAME, { connection });

// Processador do worker
async function processor(job) {
  const { assetId, prompt = '' } = job.data;

  const client = await pool.connect();
  try {
    // Simulação de geração de conteúdo (ex.: imagem renderizada)
    const url = `https://picsum.photos/seed/${job.id}/800/600`;

    await client.query(
      `UPDATE assets
         SET url = $1,
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('prompt', $2),
             updated_at = NOW()
       WHERE id = $3`,
      [url, prompt, assetId]
    );

    return { url };
  } finally {
    client.release();
  }
}

// Worker
const worker = new Worker(
  QUEUE_NAME,
  processor,
  {
    connection,
    concurrency: Number(CONTENT_RENDER_CONCURRENCY),
    // Custom backoff strategy para jobs que usarem { backoff: { type: 'customBackoff' } }
    settings: {
      backoffStrategies: {
        customBackoff: () => Number(CONTENT_RENDER_BACKOFF_MS),
      },
    },
  }
);

// Logs
worker.on('ready',     () => console.log(`[${QUEUE_NAME}] worker ready`));
worker.on('completed', (job, res) => console.log(`[${QUEUE_NAME}] completed`, job.id, res));
worker.on('failed',    (job, err) => console.error(`[${QUEUE_NAME}] failed`, job?.id, err?.message));
worker.on('error',     (err) => console.error(`[${QUEUE_NAME}] error`, err?.message || err));

// Graceful shutdown
async function graceful(signal) {
  console.log(`\n[${QUEUE_NAME}] received ${signal}, shutting down...`);
  const timeout = setTimeout(() => {
    console.error(`[${QUEUE_NAME}] forced exit after timeout`);
    process.exit(1);
  }, 10_000);

  try {
    await worker.close();
    await pool.end();
    // ioredis (connection) vem do redis-connection.js; encerre se tiver .quit()
    if (connection?.quit) await connection.quit();
    clearTimeout(timeout);
    console.log(`[${QUEUE_NAME}] closed gracefully`);
    process.exit(0);
  } catch (err) {
    console.error(`[${QUEUE_NAME}] shutdown error`, err);
    process.exit(1);
  }
}

process.on('SIGINT',  () => graceful('SIGINT'));
process.on('SIGTERM', () => graceful('SIGTERM'));

// CLI helper: enfileirar rapidamente (ex.: `node queues/content.worker.js add 123e4567...`)
if (process.argv[2] === 'add' && process.argv[3]) {
  const assetId = process.argv[3];
  (async () => {
    const job = await queue.add(
      'render',
      { assetId },
      {
        attempts: Number(CONTENT_RENDER_ATTEMPTS),
        backoff: { type: 'customBackoff' },
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
    console.log(`[${QUEUE_NAME}] enqueued job id=${job.id} assetId=${assetId}`);
    setTimeout(() => process.exit(0), 1000);
  })().catch((err) => {
    console.error('enqueue error', err);
    process.exit(1);
  });
}
