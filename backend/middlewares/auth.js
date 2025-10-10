import { authRequired } from '../middleware/auth.js';
import { getOrgFeatures } from '../services/orgFeatures.js';

// backend/middlewares/auth.js
function getUserRoles(req) {
  const single = req.user?.role ? [String(req.user.role)] : [];
  const many   = Array.isArray(req.user?.roles) ? req.user.roles.map(String) : [];
  return Array.from(new Set([...single, ...many]));
}

const ROLE_ORDER = ['OrgViewer','OrgAgent','OrgAdmin','OrgOwner','Support','SuperAdmin'];
const rank = r => ROLE_ORDER.indexOf(r);

function requireAnyRole(allowed) {
  return (req, res, next) => {
    const roles = getUserRoles(req);
    if (!roles.length) return res.status(401).json({ error: 'unauthorized' });
    if (!roles.some(r => allowed.includes(r))) {
      return res.status(403).json({ error: 'forbidden', reason: 'role_mismatch', have: roles, need_any: allowed });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    const roles = getUserRoles(req);
    if (!roles.length) return res.status(401).json({ error: 'unauthorized' });
    const min = rank(minRole);
    if (!roles.some(r => rank(r) >= min)) {
      return res.status(403).json({ error: 'forbidden', reason: 'min_role', have: roles, min: minRole });
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (typeof authRequired === 'function') {
    return authRequired(req, res, next);
  }
  if (req?.user?.id) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export { getUserRoles, requireAnyRole, requireMinRole, ROLE_ORDER };

export function requireRole(...allowed) {
  const list = allowed.flat ? allowed.flat() : allowed;
  const roles = Array.isArray(list) ? list : [list];
  return requireAnyRole(roles);
}

export function requireSuperAdmin(req, res, next) {
  return requireAnyRole(['SuperAdmin'])(req, res, next);
}

function resolveOrgId(req) {
  return (
    req.org?.id ||
    req.orgId ||
    req.org_id ||
    req.orgFromToken ||
    req.headers?.['x-org-id'] ||
    req.headers?.['x-impersonate-org-id'] ||
    req.user?.org_id ||
    null
  );
}

function resolveOrgFeaturesFromRequest(req) {
  const candidates = [
    req.orgFeatures,
    req.org?.feature_flags,
    req.org?.features,
    req.featureFlags,
    req.features,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }
  return null;
}

function isFeatureEnabled(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if ('enabled' in value) return Boolean(value.enabled);
  }
  return Boolean(value);
}

export function requireOrgFeature(feature, { optional = false } = {}) {
  const featureKey = String(feature);
  return async function requireOrgFeatureMiddleware(req, res, next) {
    try {
      const orgId = resolveOrgId(req);
      if (!orgId) {
        if (optional) return next();
        return res.status(400).json({ error: 'org_context_missing', feature: featureKey });
      }

      let features = resolveOrgFeaturesFromRequest(req);
      if (!features) {
        features = await getOrgFeatures(req.db, orgId);
      }

      req.orgFeatures = features;

      if (!isFeatureEnabled(features?.[featureKey])) {
        if (optional) return next();
        return res
          .status(403)
          .json({ error: 'forbidden', reason: 'feature_disabled', feature: featureKey, orgId });
      }

      return next();
    } catch (err) {
      req.log?.error?.({ err, feature: featureKey }, 'requireOrgFeature failed');
      return res.status(500).json({ error: 'feature_check_failed', feature: featureKey });
    }
  };
}

const defaultExport = {
  getUserRoles,
  requireAnyRole,
  requireMinRole,
  ROLE_ORDER,
  requireAuth,
  requireRole,
  requireSuperAdmin,
  requireOrgFeature,
};

export default defaultExport;

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = { getUserRoles, requireAnyRole, requireMinRole, ROLE_ORDER };
}
