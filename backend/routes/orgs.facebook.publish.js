import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { decrypt } from '../services/crypto.js';
import { requireFeature } from '../middleware/requireFeature.js';

const router = Router();

async function pageBelongs(db, orgId, pageId) {
  const { rowCount } = await db.query('SELECT 1 FROM facebook_pages WHERE org_id=$1 AND id=$2', [orgId, pageId]);
  return rowCount > 0;
}

router.post('/api/orgs/:id/facebook/pages/:pageId/publish', requireFeature('facebook_publish_daily_quota'), async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const pageId = req.params.pageId;
    if (!(await pageBelongs(req.db, orgId, pageId))) return res.status(404).json({ error: 'not_found' });

    const schema = z.object({
      type: z.enum(['text','link','image','multi_image','video']),
      message: z.string().optional(),
      link: z.string().optional(),
      media: z.any().optional(),
      scheduleAt: z.string().datetime().nullable().optional()
    });
    let { type, message, link, media, scheduleAt } = schema.parse(req.body || {});
    message = message || '';
    scheduleAt = scheduleAt || null;

    if (type === 'text' && !message) return res.status(422).json({ error: 'validation', field: 'message' });
    if (type === 'link' && !link) return res.status(422).json({ error: 'validation', field: 'link' });
    if (type === 'image' && (!media || !media.url)) return res.status(422).json({ error: 'validation', field: 'media' });
    if (type === 'video' && (!media || !media.url)) return res.status(422).json({ error: 'validation', field: 'media' });
    if (type === 'multi_image') {
      if (!Array.isArray(media) || media.length === 0 || media.length > 10) {
        return res.status(422).json({ error: 'validation', field: 'media' });
      }
    }

    const { rows: [tok] } = await req.db.query(
      `SELECT p.page_id as fb_page_id, t.access_token, t.enc_ver
         FROM facebook_pages p
         JOIN facebook_oauth_tokens t ON t.page_id=p.id
        WHERE p.org_id=$1 AND p.id=$2 AND p.is_active=true`,
      [orgId, pageId]
    );
    if (!tok) return res.status(404).json({ error: 'not_found' });
    const accessToken = decrypt({ c: tok.access_token, v: tok.enc_ver });
    const fbPageId = tok.fb_page_id;

    const payload = { type, message, link, media, scheduleAt };
    const clientKey = createHash('md5').update(JSON.stringify(payload)).digest('hex');

    if (scheduleAt && new Date(scheduleAt) > new Date()) {
      try {
        const { rows: [job] } = await req.db.query(
          `INSERT INTO facebook_publish_jobs (org_id, page_id, type, message, link, media, status, scheduled_at, client_dedupe_key)
             VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING id, status`,
          [orgId, pageId, type, message, link || null, JSON.stringify(media || null), scheduleAt, clientKey]
        );
        return res.status(202).json({ job_id: job.id });
      } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'duplicate_job' });
        throw e;
      }
    }

    if (type === 'video') {
      try {
        const { rows: [job] } = await req.db.query(
          `INSERT INTO facebook_publish_jobs (org_id, page_id, type, message, link, media, status, scheduled_at, client_dedupe_key)
             VALUES ($1,$2,$3,$4,$5,$6,'pending',now(),$7) RETURNING id`,
          [orgId, pageId, type, message, link || null, JSON.stringify(media || null), clientKey]
        );
        return res.status(202).json({ job_id: job.id });
      } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'duplicate_job' });
        throw e;
      }
    }

    let jobId;
    try {
      const { rows: [job] } = await req.db.query(
        `INSERT INTO facebook_publish_jobs (org_id, page_id, type, message, link, media, status, client_dedupe_key)
           VALUES ($1,$2,$3,$4,$5,$6,'creating',$7) RETURNING id`,
        [orgId, pageId, type, message, link || null, JSON.stringify(media || null), clientKey]
      );
      jobId = job.id;
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'duplicate_job' });
      throw e;
    }

    try {
      let postId = null;
      if (type === 'text' || type === 'link') {
        const params = new URLSearchParams({ message, access_token: accessToken });
        if (type === 'link') params.set('link', link);
        const r = await fetch(`https://graph.facebook.com/v20.0/${fbPageId}/feed`, { method: 'POST', body: params });
        if (r.status === 401) throw new Error('unauthorized');
        const data = await r.json();
        postId = data.id || data.post_id || null;
      } else if (type === 'image') {
        const params = new URLSearchParams({ url: media.url, published: 'true', access_token: accessToken });
        if (message) params.set('caption', message);
        const r = await fetch(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { method: 'POST', body: params });
        if (r.status === 401) throw new Error('unauthorized');
        const data = await r.json();
        postId = data.post_id || data.id || null;
      } else if (type === 'multi_image') {
        const ids = [];
        for (const item of media) {
          const params = new URLSearchParams({ url: item.url, published: 'false', access_token: accessToken });
          const r = await fetch(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { method: 'POST', body: params });
          if (r.status === 401) throw new Error('unauthorized');
          const d = await r.json();
          ids.push(d.id);
        }
        const params = new URLSearchParams({ access_token: accessToken });
        if (message) params.set('message', message);
        params.set('attached_media', JSON.stringify(ids.map(id => ({ media_fbid: id }))));
        const r2 = await fetch(`https://graph.facebook.com/v20.0/${fbPageId}/feed`, { method: 'POST', body: params });
        if (r2.status === 401) throw new Error('unauthorized');
        const data2 = await r2.json();
        postId = data2.id || null;
      }
      await req.db.query(`UPDATE facebook_publish_jobs SET status='done', published_post_id=$2, updated_at=now() WHERE id=$1`, [jobId, postId]);
      return res.json({ status: 'done', published_post_id: postId });
    } catch (err) {
      if (err.message === 'unauthorized') {
        await req.db.query('UPDATE facebook_pages SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2', [orgId, pageId]);
        await req.db.query(`UPDATE facebook_publish_jobs SET status='failed', error='unauthorized', updated_at=now() WHERE id=$1`, [jobId]);
        return res.status(401).json({ error: 'reauth_required' });
      }
      await req.db.query(`UPDATE facebook_publish_jobs SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [jobId, err.message || 'error']);
      return next(err);
    }
  } catch (e) { next(e); }
});

export default router;
