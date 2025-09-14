import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';

const router = Router();

router.post('/api/orgs/:orgId/suggestions/:suggestionId/approve',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const { orgId, suggestionId } = req.params;
      const { rows } = await req.db.query(
        `UPDATE content_suggestions
            SET status='approved', approved_by=$3, approved_at=now()
          WHERE org_id=$1 AND id=$2 AND status IN ('suggested','rejected')
          RETURNING id,status,approved_at`,
        [orgId, suggestionId, req.user?.id]
      );
      if (!rows[0]) return res.status(409).json({ error: 'job_locked' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
