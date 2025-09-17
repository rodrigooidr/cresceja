import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';
import { ingest, reindex } from '../services/ai/ingestService.js';

const router = Router();

const ingestSchema = z.object({
  source_type: z.string(),
  uri: z.string().url().optional(),
  lang: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
});

router.post(
  '/api/orgs/:orgId/kb/ingest',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const parsed = ingestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(422).json({ error: 'validation_error', issues: parsed.error.flatten() });
      }

      const saved = await ingest(req.params.orgId, parsed.data);
      res.status(200).json(saved);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/api/orgs/:orgId/kb/reindex',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const result = await reindex(req.params.orgId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
