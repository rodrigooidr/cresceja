import { Router } from 'express';
import * as requireRoleMod from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';
import { query as globalQuery } from '#db';

const router = Router();

const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;

router.get(
  '/api/orgs/:orgId/ai/violations',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
      const dbQuery = req.db?.query ? req.db.query.bind(req.db) : globalQuery;
      const { rows } = await dbQuery(
        `SELECT id, org_id, stage, rule, payload, created_at, created_by
           FROM ai_guardrail_violations
          WHERE org_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [req.params.orgId, limit]
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
