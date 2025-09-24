// backend/middleware/requireRole.js  (ESM-safe)

export const ROLES = {
  SuperAdmin: 'superAdmin',
  OrgAdmin: 'orgAdmin',
  Support: 'support',
  User: 'user',
};

function getPrimaryRole(user) {
  if (!user) return null;
  if (user.role) return user.role;
  if (Array.isArray(user.roles)) return user.roles[0] ?? null;
  return null;
}

function getUserRoles(user) {
  if (!user) return [];
  const list = [];
  if (user.role) list.push(user.role);
  if (Array.isArray(user.roles)) list.push(...user.roles);
  return [...new Set(list.filter(Boolean))];
}

function userHasAnyRole(user, roles = []) {
  if (!roles?.length) return true;        // no roles required → allow
  const list = getUserRoles(user);
  if (!list.length) return false;
  const set = new Set(list);
  if (set.has(ROLES.SuperAdmin)) return true; // super admin bypass
  return roles.some((role) => set.has(role));
}

export function requireRole(...roles) {
  const required = roles.flat().filter(Boolean);
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      if (!userHasAnyRole(req.user, required)) {
        return res.status(403).json({ error: 'FORBIDDEN', required });
      }
      return next();
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

      const role = getPrimaryRole(user);

      // SuperAdmin bypass
      if (role === ROLES.SuperAdmin) return next();

      // Support user with proper scope
      if ((user.is_support || role === ROLES.Support) && hasSupportScope(user, scope)) {
        return next();
      }

      return res.status(403).json({ error: 'SCOPE_FORBIDDEN', scope });
    } catch (e) {
      next(e);
    }
  };
}

// Default export as an object for compatibility with previous CommonJS pattern
export default { ROLES, requireRole, requireScope, hasSupportScope };
