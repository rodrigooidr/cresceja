import express from 'express';
import { setOrgFeatures } from '../services/orgFeatures.js';
import { requireRole } from '../middleware/auth.js';

export function createAdminOrgFeaturesRouter() {
  const router = express.Router();

  router.put(
    '/orgs/:orgId/whatsapp_session/:action(enable|disable)',
    requireRole(['SuperAdmin', 'Support']),
    async (req, res, next) => {
      try {
        const { orgId, action } = req.params;
        const enable = action === 'enable';
        await setOrgFeatures(req.db, orgId, { whatsapp_session_enabled: enable });
        res.json({ ok: true, orgId, whatsapp_session_enabled: enable });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export default createAdminOrgFeaturesRouter;
