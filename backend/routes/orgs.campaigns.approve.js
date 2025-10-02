import { Router } from 'express';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const router = Router();

router.post('/api/orgs/:orgId/suggestions/:suggestionId/approve',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const { orgId, suggestionId } = req.params;
      const { rows:[sug] } = await req.db.query(
        `SELECT date,time,channel_targets,copy_json,asset_refs,status FROM content_suggestions WHERE org_id=$1 AND id=$2`,
        [orgId, suggestionId]
      );
      if (!sug || !['suggested','rejected'].includes(sug.status)) return res.status(409).json({ error: 'job_locked' });

      const assetIds = Array.isArray(sug.asset_refs) ? sug.asset_refs.map(a=>a.asset_id) : [];
      let assets = {};
      if (assetIds.length) {
        const aRes = await req.db.query(
          `SELECT id,url,mime FROM content_assets WHERE org_id=$1 AND id = ANY($2::uuid[])`,
          [orgId, assetIds]
        );
        assets = Object.fromEntries(aRes.rows.map(r=>[r.id, r]));
      }

      const scheduleAt = new Date(`${sug.date}T${sug.time || '00:00'}Z`).toISOString();
      const jobsMap = {};
      const targets = sug.channel_targets || {};
      if (targets.instagram?.enabled) {
        const mediaUrl = assets[sug.asset_refs?.[0]?.asset_id]?.url || null;
        const { rows:[job] } = await req.db.query(
          `INSERT INTO instagram_publish_jobs (org_id, account_id, type, caption, media, status, scheduled_at)
             VALUES ($1,$2,'image',$3,$4,'pending',$5) RETURNING id`,
          [orgId, targets.instagram.accountId, sug.copy_json?.text || '', JSON.stringify({ url: mediaUrl }), scheduleAt]
        );
        jobsMap.instagram = job.id;
      }
      if (targets.facebook?.enabled) {
        const mediaUrl = assets[sug.asset_refs?.[0]?.asset_id]?.url || null;
        const { rows:[job] } = await req.db.query(
          `INSERT INTO facebook_publish_jobs (org_id, page_id, type, message, media, status, scheduled_at)
             VALUES ($1,$2,'image',$3,$4,'pending',$5) RETURNING id`,
          [orgId, targets.facebook.pageId, sug.copy_json?.text || '', JSON.stringify({ url: mediaUrl }), scheduleAt]
        );
        jobsMap.facebook = job.id;
      }

      const { rows:[updated] } = await req.db.query(
        `UPDATE content_suggestions
            SET status='approved', approved_by=$3, approved_at=now(), jobs_map=$4
          WHERE org_id=$1 AND id=$2
          RETURNING id,status,approved_at,jobs_map`,
        [orgId, suggestionId, req.user?.id, JSON.stringify(jobsMap)]
      );
      res.json(updated);
    } catch (err) { next(err); }
  }
);

export default router;
