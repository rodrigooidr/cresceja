import { Router } from 'express';
import { getFeatureAllowance, getUsage } from '../services/features.js';
import { getOrgFeatures } from '../services/orgFeatures.js';

const router = Router();

router.get('/api/orgs/:id/features', async (req, res) => {
  const orgId = req.params.id;
  const codes = [
    'whatsapp_numbers','whatsapp_mode_baileys','whatsapp_mode_api',
    'google_calendar_accounts','facebook_pages','instagram_accounts'
  ];
  const out = {};
  for (const code of codes) {
    const a = await getFeatureAllowance(orgId, code, req.db);
    const used = await getUsage(orgId, code, req.db);
    out[code] = { enabled: !!a.enabled, limit: a.limit, used };
  }
  const featureToggles = await getOrgFeatures(req.db, orgId);
  res.json({ ...out, feature_flags: featureToggles, features: featureToggles });
});

export default router;
