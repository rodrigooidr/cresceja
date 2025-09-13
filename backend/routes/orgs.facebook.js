import { Router } from 'express';
import { decrypt } from '../services/crypto.js';

const router = Router();

router.get('/api/orgs/:id/facebook/pages', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const { rows } = await req.db.query(
      `SELECT id, page_id, name, category, is_active
         FROM facebook_pages
        WHERE org_id=$1
        ORDER BY created_at ASC`,
      [orgId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.delete('/api/orgs/:id/facebook/pages/:pageId', async (req, res, next) => {
  try {
    const { id, pageId } = { id: req.params.id, pageId: req.params.pageId };
    await req.db.query('DELETE FROM facebook_pages WHERE org_id=$1 AND id=$2', [id, pageId]);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/api/orgs/:id/facebook/pages/:pageId/posts', async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const pageId = req.params.pageId;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { rows: [row] = [] } = await req.db.query(
      `SELECT p.page_id, t.access_token
         FROM facebook_pages p
         JOIN facebook_oauth_tokens t ON t.page_id = p.id
        WHERE p.org_id=$1 AND p.id=$2`,
      [orgId, pageId]
    );
    if (!row) return res.status(404).json({ error: 'not_found' });
    const token = decrypt(row.access_token);
    const url = new URL(`https://graph.facebook.com/v19.0/${row.page_id}/posts`);
    url.searchParams.set('fields', 'id,message,created_time,permalink_url');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('access_token', token);
    const fbRes = await fetch(url.toString());
    if (!fbRes.ok) {
      if (fbRes.status >= 400 && fbRes.status < 500) {
        await req.db.query('UPDATE facebook_pages SET is_active=false, updated_at=now() WHERE org_id=$1 AND id=$2', [orgId, pageId]);
        return res.status(409).json({ error: 'reauth_required' });
      }
      return res.status(502).json({ error: 'fb_api_error' });
    }
    const data = await fbRes.json();
    res.json(data.data || []);
  } catch (e) { next(e); }
});

export default router;
