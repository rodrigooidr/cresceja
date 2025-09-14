import pino from 'pino';
import { pool } from '#db';

const logger = pino({ name: 'campaigns-sync-worker' });

export async function syncOnce(customPool = pool) {
  const client = await customPool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, jobs_map FROM content_suggestions
        WHERE status IN ('approved','scheduled')`
    );
    for (const r of rows) {
      const jobs = r.jobs_map || {};
      let allDone = true;
      for (const [channel, jobId] of Object.entries(jobs)) {
        if (!jobId) { allDone = false; break; }
        const table = channel === 'instagram' ? 'instagram_publish_jobs' : 'facebook_publish_jobs';
        const { rows:[job] } = await client.query(`SELECT status FROM ${table} WHERE id=$1`, [jobId]);
        if (!job || job.status !== 'done') { allDone = false; break; }
      }
      if (allDone) {
        await client.query(
          `UPDATE content_suggestions SET status='published', published_at=now(), updated_at=now() WHERE id=$1`,
          [r.id]
        );
      }
    }
  } catch (err) {
    logger.error({ err }, 'sync error');
  } finally {
    client.release();
  }
}

export function startCampaignsSyncWorker() {
  syncOnce();
  const timer = setInterval(syncOnce, 60_000);
  logger.info('campaigns sync worker started');
  return () => clearInterval(timer);
}
