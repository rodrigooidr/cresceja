import { Router } from 'express';
import { z } from 'zod';
import { requireFeature } from '../middleware/requireFeature.js';
import { refreshIfNeeded } from '../services/instagramTokens.js';

const router = Router();

async function accountBelongs(db, orgId, accountId) {
  const { rowCount } = await db.query('SELECT 1 FROM instagram_accounts WHERE org_id=$1 AND id=$2', [orgId, accountId]);
  return rowCount > 0;
}

router.post('/api/orgs/:id/instagram/accounts/:accountId/publish', requireFeature('instagram_publish_daily_quota'), async (req,res,next) => {
  try {
    const orgId = req.params.id;
    const accountId = req.params.accountId;
    if (!(await accountBelongs(req.db, orgId, accountId))) return res.status(404).json({ error: 'not_found' });

    const schema = z.object({
      type: z.enum(['image','carousel','video']),
      caption: z.string().max(2200).optional().default(''),
      media: z.any(),
      scheduleAt: z.string().datetime().nullable().optional(),
    });
    let { type, caption, media, scheduleAt } = schema.parse(req.body || {});
    if (type === 'image' && (!media || !media.url)) return res.status(422).json({ error: 'validation', field: 'media' });
    if (type === 'video' && (!media || !media.url)) return res.status(422).json({ error: 'validation', field: 'media' });
    if (type === 'carousel') {
      if (!Array.isArray(media) || media.length === 0 || media.length > 10) {
        return res.status(422).json({ error: 'validation', field: 'media' });
      }
    }

    const tok = await refreshIfNeeded(req.db, accountId, orgId);
    if (!tok) return res.status(404).json({ error: 'not_found' });
    const { rows:[acc] } = await req.db.query('SELECT ig_user_id FROM instagram_accounts WHERE org_id=$1 AND id=$2',[orgId, accountId]);
    const igUserId = acc?.ig_user_id;
    if (!igUserId) return res.status(404).json({ error: 'not_found' });

    if (scheduleAt && new Date(scheduleAt) > new Date()) {
      const { rows:[job] } = await req.db.query(
        `INSERT INTO instagram_publish_jobs (org_id, account_id, type, caption, media, status, scheduled_at)
           VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id, status`,
        [orgId, accountId, type, caption, JSON.stringify(media), scheduleAt]
      );
      return res.status(201).json(job);
    }

    try {
      const params = new URLSearchParams({ access_token: tok.access_token, caption });
      if (type === 'image' || type === 'video') params.set(type === 'image' ? 'image_url' : 'video_url', media.url);
      const r1 = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, { method: 'POST', body: params });
      if (r1.status === 401) throw new Error('unauthorized');
      const data1 = await r1.json();
      const creationId = data1.id;
      const r2 = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish?creation_id=${creationId}&access_token=${tok.access_token}`, { method: 'POST' });
      if (r2.status === 401) throw new Error('unauthorized');
      const data2 = await r2.json();
      await req.db.query(
        `INSERT INTO instagram_publish_jobs (org_id, account_id, type, caption, media, status, creation_id, published_media_id)
           VALUES ($1,$2,$3,$4,$5,'done',$6,$7)`,
        [orgId, accountId, type, caption, JSON.stringify(media), creationId, data2.id]
      );
      return res.json({ status: 'done', published_media_id: data2.id });
    } catch (err) {
      if (err.message === 'unauthorized') {
        await req.db.query('UPDATE instagram_accounts SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2',[orgId, accountId]);
        return res.status(401).json({ error: 'reauth_required' });
      }
      if (err.message === 'quota') return res.status(409).json({ error: 'ig_quota_reached' });
      return next(err);
    }
  } catch (e) { next(e); }
});

export default router;
