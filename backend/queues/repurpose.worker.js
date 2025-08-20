import 'dotenv/config';
import { Worker, Queue, QueueScheduler } from 'bullmq';
import { getRedis } from '../config/redis.js';
import pg from 'pg';

const {
  DATABASE_URL,
  REDIS_URL,
  REPURPOSE_CONCURRENCY = '2',
  REPURPOSE_ATTEMPTS = '3',
  REPURPOSE_BACKOFF_MS = '2000',
} = process.env;

// ---- Redis (BullMQ aceita ioredis client diretamente) ----------------------
const connection = getRedis(); // getRedis() deve criar ioredis com { maxRetriesPerRequest:null, enableReadyCheck:false }

// ---- Postgres Pool (reuso eficiente de conexões) ----------------------------
const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10, // ajuste conforme sua carga
  idleTimeoutMillis: 30_000,
});

// ---- Nome da fila -----------------------------------------------------------
const QUEUE_NAME = 'repurpose';

// (Opcional) Producer/Queue (útil se você enfileirar daqui ou quiser consultar)
export const queue = new Queue(QUEUE_NAME, { connection });

// Scheduler para delayed/retries/locks (recomendado)
const scheduler = new QueueScheduler(QUEUE_NAME, { connection });

// ---- Processor --------------------------------------------------------------
async function processor(job) {
  const { postId, modes = ['story', 'email', 'video'] } = job.data;

  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM social_posts WHERE id = $1', [postId]);
    const post = rows[0];
    if (!post) {
      await client.query(
        `INSERT INTO repurpose_jobs (post_id, status, result, finished_at)
         VALUES ($1,'not_found','{}', NOW())
         ON CONFLICT (post_id) DO UPDATE SET status='not_found', finished_at=NOW()`,
        [postId]
      );
      return { ok: false, reason: 'post_not_found' };
    }

    for (const m of modes) {
      let title = post.title;
      let content = post.content;
      let channel = post.channel;

      if (m === 'story')  { channel = 'instagram_story'; content = (post.content || '').slice(0, 180); }
      if (m === 'email')  { channel = 'email_marketing'; title = `[Newsletter] ${post.title}`; }
      if (m === 'video')  { channel = 'reels_tiktok'; content = `${post.content}\n\n#video`; }

      await client.query(
        `INSERT INTO social_posts
         (company_id, title, content, media_url, channel, scheduled_at, status, created_by)
         VALUES ($1,$2,$3,$4,$5,NULL,'pendente',$6)`,
        [post.company_id || null, title, content, post.media_url || null, channel, post.created_by || null]
      );
    }

    await client.query(
      `INSERT INTO repurpose_jobs (post_id, status, result, finished_at)
       VALUES ($1,'completed','{}', NOW())
       ON CONFLICT (post_id) DO UPDATE SET status='completed', finished_at=NOW()`,
      [postId]
    );

    return { ok: true };
  } finally {
    client.release();
  }
}

// ---- Worker ----------------------------------------------------------------
const worker = new Worker(
  QUEUE_NAME,
  processor,
  {
    connection,
    concurrency: Number(REPURPOSE_CONCURRENCY),
    // Tentativas e backoff simples (exponencial linear)
    settings: {
      backoffStrategies: {
        customBackoff: () => Number(REPURPOSE_BACKOFF_MS),
      },
    },
    // attempts é definido por-job, mas dá para forçar default no add(); abaixo um fallback:
  }
);

// Logs
worker.on('ready',       () => console.log(`[${QUEUE_NAME}] worker ready`));
worker.on('active',      (job) => console.log(`[${QUEUE_NAME}] active`, job.id, job.name));
worker.on('completed',   (job, res) => console.log(`[${QUEUE_NAME}] completed`, job.id, res));
worker.on('failed',      (job, err) => console.error(`[${QUEUE_NAME}] failed`, job?.id, err?.message));
worker.on('error',       (err) => console.error(`[${QUEUE_NAME}] error`, err));

// Scheduler logs
scheduler.on('failed', (jobId, err) => console.error(`[${QUEUE_NAME}] scheduler failed`, jobId, err?.message));
scheduler.on('error',  (err) => console.error(`[${QUEUE_NAME}] scheduler error`, err));

console.log(`Repurpose worker online. Concurrency=${REPURPOSE_CONCURRENCY}, AttemptsDefault=${REPURPOSE_ATTEMPTS}`);

// ---- Encerramento limpo -----------------------------------------------------
async function gracefulShutdown(signal) {
  console.log(`\n[${QUEUE_NAME}] received ${signal}, shutting down...`);
  const timeout = setTimeout(() => {
    console.error(`[${QUEUE_NAME}] forced exit after timeout`);
    process.exit(1);
  }, 10_000);

  try {
    await worker.close();     // fecha fila do worker
    await scheduler.close();  // fecha scheduler
    await pool.end();         // fecha pool do PG
    if (connection?.quit) await connection.quit(); // ioredis
    clearTimeout(timeout);
    console.log(`[${QUEUE_NAME}] closed gracefully`);
    process.exit(0);
  } catch (err) {
    console.error(`[${QUEUE_NAME}] shutdown error`, err);
    process.exit(1);
  }
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ---- (Opcional) helper para enfileirar localmente ---------------------------
// Exemplo de uso: node queues/repurpose.worker.js add 123
if (process.argv[2] === 'add' && process.argv[3]) {
  const postId = Number(process.argv[3]);
  (async () => {
    const job = await queue.add('repurpose-job', { postId }, {
      attempts: Number(REPURPOSE_ATTEMPTS),
      backoff: { type: 'customBackoff' },
      removeOnComplete: true,
      removeOnFail: 100,
    });
    console.log(`[${QUEUE_NAME}] enfileirado job id=${job.id} p/ postId=${postId}`);
    setTimeout(() => process.exit(0), 1000);
  })().catch(err => {
    console.error('enqueue error', err);
    process.exit(1);
  });
}
