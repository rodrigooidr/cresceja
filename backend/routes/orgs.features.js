import { Router } from 'express';
import { getFeatureAllowance, getUsage } from '../services/features.js';

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
  res.json(out);
});

export default router;
