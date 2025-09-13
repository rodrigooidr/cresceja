import { getFeatureAllowance, getUsage } from '../services/features.js';

export function requireFeature(featureCode) {
  return async (req, res, next) => {
    const orgId = req.headers['x-org-id'] || req.headers['x-impersonate-org-id'];
    if (!orgId) return res.status(400).json({ error: 'org_required' });

    const allow = await getFeatureAllowance(orgId, featureCode, req.db);
    if (!allow.enabled || allow.limit === 0) {
      return res.status(403).json({ error: 'feature_disabled', feature: featureCode });
    }
    if (Number.isInteger(allow.limit)) {
      const used = await getUsage(orgId, featureCode, req.db);
      if (used >= allow.limit) {
        return res.status(403).json({ error: 'feature_limit_reached', feature: featureCode, used, limit: allow.limit });
      }
    }
    next();
  };
}

export default { requireFeature };
