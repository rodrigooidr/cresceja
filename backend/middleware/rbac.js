// backend/middleware/rbac.js
import { ROLES, hasOrgRole, hasGlobalRole } from '../lib/permissions.js';

export function requireAny(roles) {
  const wanted = roles?.filter(Boolean) ?? [];
  return (req, res, next) => {
    const user = req.user;
    if (!user?.role) {
      return res.status(403).json({ message: 'forbidden' });
    }

    if (hasGlobalRole(user, [ROLES.SuperAdmin])) {
      return next();
    }

    if (wanted.length && hasGlobalRole(user, wanted)) {
      return next();
    }

    if (wanted.length && hasOrgRole(user, wanted)) {
      return next();
    }

    return res.status(403).json({ message: 'forbidden' });
  };
}

export const requireAgent = requireAny([ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin]);
export const requireManager = requireAny([ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin]);
