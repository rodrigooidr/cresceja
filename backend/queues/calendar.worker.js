import 'dotenv/config';
import pkg from 'bullmq';
const { Worker, Queue, QueueScheduler } = pkg;
import { redis as connection } from '../config/redis.js';
import pg from 'pg';

const { DATABASE_URL } = process.env;

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

const QUEUE_NAME = 'calendar:tick';

export const queue = new Queue(QUEUE_NAME, { connection });
const scheduler = new QueueScheduler(QUEUE_NAME, { connection });

async function processor(job) {
  const { orgId } = job.data;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT template_id FROM email_automations
         WHERE org_id=$1 AND type='birthday' AND status='on'`,
      [orgId]
    );
    const auto = rows[0];
    if (!auto) return { skipped: 'no_automation' };
    const name = `Birthday ${new Date().toISOString().slice(0,10)}`;
    const camp = await client.query(
      `INSERT INTO email_campaigns (org_id, name, template_id, status)
       VALUES ($1,$2,$3,'scheduled')
       RETURNING id`,
      [orgId, name, auto.template_id]
    );
    return { campaignId: camp.rows[0].id };
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

if (process.argv[2] === 'schedule' && process.argv[3]) {
  const orgId = process.argv[3];
  (async () => {
    await queue.add('tick', { orgId }, { repeat: { cron: '0 8 * * *' }, removeOnComplete: true });
    console.log(`[${QUEUE_NAME}] scheduled for org ${orgId}`);
    setTimeout(() => process.exit(0), 1000);
  })().catch((err) => {
    console.error('schedule error', err);
    process.exit(1);
  });
}
