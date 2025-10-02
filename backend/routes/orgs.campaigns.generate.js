import { Router } from 'express';
import { z } from 'zod';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { generateCampaign } from '../services/campaigns.js';

const router = Router();

const schema = z.object({
  title: z.string().min(1),
  monthRef: z.string().regex(/^\d{4}-\d{2}-01$/),
  defaultTargets: z.record(z.any()).default({}),
  frequency: z.number().int().positive().max(31).default(30),
  profile: z.record(z.any()).default({}),
  blacklistDates: z.array(z.string()).default([]),
  timeWindows: z.array(z.object({ start: z.string(), end: z.string() })).default([]),
  timezone: z.string().default('America/Sao_Paulo')
});

router.post('/api/orgs/:orgId/campaigns/generate',
  requireRole(ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.Support, ROLES.SuperAdmin),
  requireFeature('ai_calendar_generator'),
  async (req, res, next) => {
    try {
      const orgId = req.params.orgId;
      const input = schema.parse(req.body || {});
      const { campaignId, suggestions } = await generateCampaign(req.db, orgId, {
        ...input,
        userId: req.user?.id
      });
      res.json({ campaignId, suggestions });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
