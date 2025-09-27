// backend/middleware/requireRole.js  (ESM-safe)

import {
  GLOBAL_ROLES,
  ORG_ROLES,
  ROLES,
  hasGlobalRole,
  hasOrgRole,
} from '../lib/permissions.js';

function userHasAnyRole(user, roles = []) {
  if (!roles?.length) return true; // no roles required → allow
  if (!user) return false;

  if (hasGlobalRole(user, [ROLES.SuperAdmin])) return true;

  const normalized = roles.flat().filter(Boolean);
  if (!normalized.length) return true;

  const wantedOrgRoles = normalized.filter((role) => ORG_ROLES.includes(role));
  if (wantedOrgRoles.length && hasOrgRole(user, wantedOrgRoles)) {
    return true;
  }

  const wantedGlobalRoles = normalized.filter((role) => GLOBAL_ROLES.includes(role));
  if (wantedGlobalRoles.length && hasGlobalRole(user, wantedGlobalRoles)) {
    return true;
  }

  return false;
}

export { ROLES };

export function requireRole(...roles) {
  const required = roles.flat().filter(Boolean);
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      if (!userHasAnyRole(req.user, required)) {
        req.log?.warn({ user: req.user, need: roles, path: req.originalUrl }, 'RBAC deny');
        return res.status(403).json({ error: 'forbidden' });
      }
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

export function requireGlobalRole(roles = []) {
  const required = Array.isArray(roles) ? roles.flat().filter(Boolean) : [roles].filter(Boolean);
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      const isAllowed = !required.length || hasGlobalRole(req.user, required);
      if (isAllowed) {
        return next();
      }
      req.log?.warn({ user: req.user, need: roles, path: req.originalUrl }, 'RBAC deny');
      return res.status(403).json({ error: 'forbidden' });
    } catch (e) {
      return next(e);
    }
  };
}

/**
 * Checks if a support user has the given scope.
 * Accepts: user.supportScopes | user.support_scopes | user.scopes
 * - array of strings
 * - comma/space separated string
 * - '*' wildcard
 */
export function hasSupportScope(user, scope) {
  if (!scope) return true; // no scope required
  if (!hasGlobalRole(user, [ROLES.Support])) return false;

  const raw =
    user?.supportScopes ??
    user?.support_scopes ??
    user?.scopes ??
    [];

  if (raw === '*') return true;

  if (typeof raw === 'string') {
    const items = raw.split(/[,\s]+/).filter(Boolean);
    return items.includes(scope);
  }

  if (Array.isArray(raw)) {
    return raw.includes(scope);
  }

  return false;
}

export function requireScope(scope) {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      if (hasGlobalRole(user, [ROLES.SuperAdmin])) return next();

      if (hasGlobalRole(user, [ROLES.Support]) && hasSupportScope(user, scope)) {
        return next();
      }

      return res.status(403).json({ error: 'SCOPE_FORBIDDEN', scope });
    } catch (e) {
      next(e);
    }
  };
}

// Default export as an object for compatibility with previous CommonJS pattern
const legacyExport = Object.assign(requireRole, {
  ROLES,
  requireRole,
  requireGlobalRole,
  requireScope,
  hasSupportScope,
});

export default legacyExport;
