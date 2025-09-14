import { Router } from 'express';
import { z } from 'zod';

const router = Router();

async function jobBelongs(db, orgId, jobId) {
  const { rowCount } = await db.query('SELECT 1 FROM facebook_publish_jobs WHERE org_id=$1 AND id=$2', [orgId, jobId]);
  return rowCount > 0;
}

router.get('/api/orgs/:id/facebook/jobs', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const { rows } = await req.db.query(
      `SELECT id, page_id, type, status, scheduled_at, updated_at, published_post_id, error
         FROM facebook_publish_jobs WHERE org_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/api/orgs/:id/facebook/jobs/:jobId', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const jobId = req.params.jobId;
    if (!(await jobBelongs(req.db, orgId, jobId))) return res.status(404).json({ error: 'not_found' });
    const { rows:[job] } = await req.db.query(
      'SELECT id, page_id, type, status, scheduled_at, updated_at, published_post_id, error FROM facebook_publish_jobs WHERE org_id=$1 AND id=$2',
      [orgId, jobId]
    );
    res.json(job);
  } catch (e) { next(e); }
});

router.patch('/api/orgs/:id/facebook/jobs/:jobId', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const jobId = req.params.jobId;
    if (!(await jobBelongs(req.db, orgId, jobId))) return res.status(404).json({ error: 'not_found' });
    const schema = z.object({ status: z.enum(['canceled']).optional(), scheduled_at: z.string().datetime().optional() });
    const body = schema.parse(req.body || {});
    const { rows:[job] } = await req.db.query('SELECT status FROM facebook_publish_jobs WHERE org_id=$1 AND id=$2', [orgId, jobId]);
    if (job.status !== 'pending') return res.status(409).json({ error: 'job_not_pending' });
    if (body.status === 'canceled') {
      await req.db.query(`UPDATE facebook_publish_jobs SET status='canceled', updated_at=now() WHERE org_id=$1 AND id=$2`, [orgId, jobId]);
    }
    if (body.scheduled_at) {
      await req.db.query(`UPDATE facebook_publish_jobs SET scheduled_at=$3, updated_at=now() WHERE org_id=$1 AND id=$2`, [orgId, jobId, body.scheduled_at]);
    }
    const { rows:[updated] } = await req.db.query('SELECT id, status, scheduled_at, updated_at FROM facebook_publish_jobs WHERE org_id=$1 AND id=$2', [orgId, jobId]);
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
