import 'dotenv/config';
import pkg from 'bullmq';
const { Worker, QueueScheduler } = pkg;
import { redis as connection } from '../config/redis.js';
import pg from 'pg';
import { getProvider } from '../services/email/index.js';

const { DATABASE_URL } = process.env;

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

const QUEUE_NAME = 'email-send';

const scheduler = new QueueScheduler(QUEUE_NAME, { connection });

async function processor(job) {
  const { to, subject, html, orgId, campaignId, recipientId, provider = 'ses' } = job.data;
  const client = await pool.connect();
  try {
    const sup = await client.query(
      'SELECT 1 FROM email_suppressions WHERE org_id = $1 AND email = $2',
      [orgId, to]
    );
    if (sup.rowCount > 0) {
      await client.query(
        `INSERT INTO email_events (org_id, campaign_id, recipient_id, event_type, meta)
         VALUES ($1,$2,$3,'suppressed',jsonb_build_object('email',$4))`,
        [orgId, campaignId || null, recipientId || null, to]
      );
      return { skipped: 'suppressed' };
    }
    const prov = getProvider(provider);
    await prov.sendEmail({ to, subject, html });
    await client.query(
      `INSERT INTO email_events (org_id, campaign_id, recipient_id, event_type, meta)
       VALUES ($1,$2,$3,'sent',jsonb_build_object('email',$4))`,
      [orgId, campaignId || null, recipientId || null, to]
    );
    if (recipientId) {
      await client.query(
        'UPDATE email_campaign_recipients SET status=$1, sent_at=NOW() WHERE id=$2 AND org_id=$3',
        ['sent', recipientId, orgId]
      );
    }
    return { ok: true };
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
