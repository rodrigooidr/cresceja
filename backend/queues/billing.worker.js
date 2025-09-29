import 'dotenv/config';
import pkg from 'bullmq';
const { Worker, Queue, QueueScheduler } = pkg;
import { redis as connection } from '../config/redis.js';
import pg from 'pg';
import { enqueue as sendEmail } from '../services/email/index.js';

const { DATABASE_URL } = process.env;

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

const QUEUE_NAME = 'billing:renewals';

export const queue = new Queue(QUEUE_NAME, { connection });
const scheduler = new QueueScheduler(QUEUE_NAME, { connection });

async function processor() {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await client.query(
      `SELECT id, org_id, due_date FROM invoices WHERE status='pending' AND due_date <= $1`,
      [today]
    );
    for (const inv of rows) {
      const diff = Math.floor((new Date(today) - new Date(inv.due_date)) / 86400000);
      if (diff === 0) {
        await sendEmail({ to: 'owner@example.com', subject: 'Lembrete de cobrança', html: 'Sua fatura vence hoje.', orgId: inv.org_id });
      } else if (diff === 2) {
        await sendEmail({ to: 'owner@example.com', subject: 'Fatura em atraso', html: 'Sua fatura está em atraso.', orgId: inv.org_id });
      } else if (diff >= 8) {
        await client.query('UPDATE organizations SET status=$1 WHERE id=$2', ['inactive', inv.org_id]);
      }
    }
    return { processed: rows.length };
  } finally {
    client.release();
  }
}

const worker = new Worker(QUEUE_NAME, processor, { connection });

worker.on('ready', () => console.log(`[${QUEUE_NAME}] worker ready`));
worker.on('failed', (job, err) => console.error(`[${QUEUE_NAME}] failed`, job?.id, err?.message));
worker.on('error', (err) => console.error(`[${QUEUE_NAME}] error`, err));

scheduler.on('failed', (jobId, err) => console.error(`[${QUEUE_NAME}] scheduler failed`, jobId, err?.message));
scheduler.on('error', (err) => console.error(`[${QUEUE_NAME}] scheduler error`, err));

async function graceful(signal) {
  console.log(`\n[${QUEUE_NAME}] received ${signal}, shutting down...`);
  const timeout = setTimeout(() => {
    console.error(`[${QUEUE_NAME}] forced exit after timeout`);
    process.exit(1);
  }, 10_000);
  try {
    await worker.close();
    await scheduler.close();
    await pool.end();
    if (connection?.quit) await connection.quit();
    clearTimeout(timeout);
    console.log(`[${QUEUE_NAME}] closed gracefully`);
    process.exit(0);
  } catch (err) {
    console.error(`[${QUEUE_NAME}] shutdown error`, err);
    process.exit(1);
  }
}

process.on('SIGINT', () => graceful('SIGINT'));
process.on('SIGTERM', () => graceful('SIGTERM'));

if (process.argv[2] === 'schedule') {
  (async () => {
    await queue.add('tick', {}, { repeat: { cron: '0 8 * * *' }, removeOnComplete: true });
    console.log(`[${QUEUE_NAME}] scheduled daily`);
    setTimeout(() => process.exit(0), 1000);
  })().catch((err) => {
    console.error('schedule error', err);
    process.exit(1);
  });
}
