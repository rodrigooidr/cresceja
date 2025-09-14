import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';

const router = Router();

router.post('/api/orgs/:orgId/assets',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const { orgId } = req.params;
      const { url, mime, width, height, meta_json } = req.body || {};
      if (!url || !mime) return res.status(400).json({ error: 'validation', field: !url ? 'url' : 'mime' });
      const base = process.env.S3_PUBLIC_URL || (process.env.S3_BUCKET ? `https://${process.env.S3_BUCKET}.s3.amazonaws.com` : '');
      const allowedHost = new URL(base).host;
      let parsedUrl;
      try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'invalid_url' }); }
      if (parsedUrl.host !== allowedHost) return res.status(400).json({ error: 'invalid_url' });
      const normMime = String(mime).toLowerCase();
      const normWidth = width ? parseInt(width,10) || null : null;
      const normHeight = height ? parseInt(height,10) || null : null;
      const { rows } = await req.db.query(
        `INSERT INTO content_assets (org_id, url, mime, width, height, meta_json)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, url`,
        [orgId, url, normMime, normWidth, normHeight, meta_json ? JSON.stringify(meta_json) : null]
      );
      res.json({ asset_id: rows[0].id, url: rows[0].url });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/api/orgs/:orgId/assets',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const { orgId } = req.params;
      const { query = '', page = 1, pageSize = 50 } = req.query;
      const limit = Math.max(parseInt(pageSize,10) || 50,1);
      const offset = (Math.max(parseInt(page,10)||1,1)-1)*limit;
      const { rows } = await req.db.query(
        `SELECT id as asset_id, url, mime, width, height, meta_json
           FROM content_assets
          WHERE org_id=$1 AND ($2::text='' OR url ILIKE '%'||$2||'%')
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4`,
        [orgId, query, limit, offset]
      );
      const totalRes = await req.db.query(
        `SELECT COUNT(*)::int AS total FROM content_assets WHERE org_id=$1 AND ($2::text='' OR url ILIKE '%'||$2||'%')`,
        [orgId, query]
      );
      res.json({ items: rows, total: totalRes.rows[0].total });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
