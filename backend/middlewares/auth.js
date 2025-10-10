import { authRequired } from '../middleware/auth.js';
import { getOrgFeatures } from '../services/orgFeatures.js';

function normalizeRoles(input) {
  const initial = Array.isArray(input) ? input : [input];
  const flattened = initial.flatMap((value) => (Array.isArray(value) ? value : [value]));
  const unique = new Set(
    flattened
      .filter((role) => role !== null && role !== undefined && String(role).trim() !== '')
      .map((role) => String(role)),
  );
  return Array.from(unique);
}

export function getUserRoles(req) {
  const single = req?.user?.role ? [req.user.role] : [];
  const many = Array.isArray(req?.user?.roles) ? req.user.roles : [];
  return normalizeRoles([...single, ...many]);
}

export function requireAuth(req, res, next) {
  if (typeof authRequired === 'function') {
    return authRequired(req, res, next);
  }
  if (req?.user?.id) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export function requireAnyRole(allowed = []) {
  const wanted = normalizeRoles(allowed);
  return (req, res, next) => {
    const roles = getUserRoles(req);
    if (!roles.length) {
      return res.status(401).json({ error: 'unauthorized', reason: 'missing_role' });
    }
    if (!wanted.length) {
      return next();
    }
    const ok = roles.some((role) => wanted.includes(role));
    if (!ok) {
      return res
        .status(403)
        .json({ error: 'forbidden', reason: 'role_mismatch', have: roles, need: wanted });
    }
    return next();
  };
}

export function requireRole(...allowed) {
  const roles = normalizeRoles(allowed);
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
          .json({
            error: 'forbidden',
            reason: 'feature_disabled',
            feature: featureKey,
            orgId,
          });
      }

      return next();
    } catch (err) {
      req.log?.error?.({ err, feature: featureKey }, 'requireOrgFeature failed');
      return res.status(500).json({ error: 'feature_check_failed', feature: featureKey });
    }
  };
}
