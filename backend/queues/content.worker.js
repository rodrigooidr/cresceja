import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import connection from './redis-connection.js';
import pg from 'pg';

const {
  DATABASE_URL,
  CONTENT_RENDER_CONCURRENCY = '2',
  CONTENT_RENDER_BACKOFF_MS = '2000',
} = process.env;

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

const QUEUE_NAME = 'content';
export const queue = new Queue(QUEUE_NAME, { connection });

async function processor(job) {
  if (job.name === 'render') {
    const { assetId, prompt = '' } = job.data;
    const client = await pool.connect();
    try {
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

  if (job.name === 'transcribe') {
    console.log('[content.worker] transcribe job', job.id, job.data);
    return { ok: true, kind: 'transcribe' };
  }

  console.warn('[content.worker] unhandled job', job.name, job.id);
  return { ok: true, ignored: true };
}

const worker = new Worker(QUEUE_NAME, processor, {
  connection,
  concurrency: Number(CONTENT_RENDER_CONCURRENCY),
  settings: {
    backoffStrategies: {
      customBackoff: () => Number(CONTENT_RENDER_BACKOFF_MS),
    },
  },
});

worker.on('ready',     () => console.log('[content] worker ready'));
worker.on('completed', (job, res) => console.log('[content] completed', job.id, res));
worker.on('failed',    (job, err) => console.error('[content] failed', job?.id, err?.message));
worker.on('error',     (err) => console.error('[content] error', err?.message || err));

async function graceful(signal) {
  console.log(`\n[content] received ${signal}, shutting down...`);
  const timeout = setTimeout(() => {
    console.error('[content] forced exit after timeout');
    process.exit(1);
  }, 10_000);
  try {
    await worker.close();
    await pool.end();
    if (connection?.quit) await connection.quit();
    clearTimeout(timeout);
    console.log('[content] closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('[content] shutdown error', err);
    process.exit(1);
  }
}
process.on('SIGINT',  () => graceful('SIGINT'));
process.on('SIGTERM', () => graceful('SIGTERM'));
