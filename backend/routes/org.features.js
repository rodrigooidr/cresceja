import express from 'express';
import { getFeatureAllowance, getUsage } from '../services/features.js';
import { getOrgFeatures } from '../services/orgFeatures.js';

const router = express.Router();
const isProd = String(process.env.NODE_ENV) === 'production';

// GET /api/orgs/:orgId/features
router.get('/api/orgs/:orgId/features', async (req, res) => {
  const { orgId } = req.params;

  if (!req.org?.id && !isProd) {
    return res.json({ feature_flags: {}, features: {} });
  }

  const quotaCodes = [
    'whatsapp_numbers',
    'whatsapp_mode_baileys',
    'whatsapp_mode_api',
    'google_calendar_accounts',
    'facebook_pages',
    'instagram_accounts',
    'instagram_publish_daily_quota',
    'facebook_publish_daily_quota',
  ];

  const allowances = {};
  for (const code of quotaCodes) {
    const allowance = await getFeatureAllowance(orgId, code, req.db);
    const used = await getUsage(orgId, code, req.db);
    allowances[code] = { enabled: !!allowance.enabled, limit: allowance.limit, used };
  }

  const featureToggles = await getOrgFeatures(req.db, orgId);
  const fallbackFeatures = {
    inbox: true,
    inbox_conversations_v2: true,
    ai_draft: true,
    ai_summarize: true,
    ai_classify: true,
    templates: true,
    google_calendar_integration: false,
    calendar_scheduling: true,
  };

  const featureConfigs = {
    inbox: { enabled: true, limit: null },
    inbox_conversations_v2: { enabled: true, limit: null },
    ai_draft: { enabled: true, limit: null },
    ai_summarize: { enabled: true, limit: null },
    ai_classify: { enabled: true, limit: null },
    templates: { enabled: true, limit: null },
    google_calendar_integration: { enabled: false, limit: null },
    calendar_scheduling: { enabled: true, limit: null },
  };

  const resolvedFeatures = Object.keys(featureToggles || {}).length ? featureToggles : fallbackFeatures;

  return res.status(200).json({
    org_id: orgId,
    ...allowances,
    feature_flags: featureToggles,
    features: resolvedFeatures,
    feature_configs: featureConfigs,
  });
});

export default router;
