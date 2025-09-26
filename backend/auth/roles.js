import {
  ORG_ROLES,
  ROLES,
  hasGlobalRole,
  hasOrgRole,
} from '../lib/permissions.js';

const ORG_ROLE_ORDER = ORG_ROLES;

export function hasRoleAtLeast(role, min = ROLES.OrgViewer) {
  const currentIndex = ORG_ROLE_ORDER.indexOf(role || '');
  const requiredIndex = ORG_ROLE_ORDER.indexOf(min || '');
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
}

export const CAN_VIEW_ORGANIZATIONS_ADMIN = (user) =>
  hasGlobalRole(user, [ROLES.SuperAdmin, ROLES.Support]);

export const CAN_EDIT_CLIENTS = (user) =>
  hasGlobalRole(user, [ROLES.SuperAdmin, ROLES.Support]) ||
  hasOrgRole(user, [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner]);

export function requireMinRole(minRole = ROLES.OrgViewer) {
  return function (req, res, next) {
    const user = req.user;
    if (!user?.role) {
      return res.status(401).json({ error: 'forbidden' });
    }
    if (hasGlobalRole(user, [ROLES.SuperAdmin])) {
      return next();
    }
    if (hasRoleAtLeast(user.role, minRole)) {
      return next();
    }
    return res.status(403).json({ error: 'forbidden', detail: `min_role:${minRole}` });
  };
}

export function requireRole(check) {
  return function (req, res, next) {
    const user = req.user;
    if (!user?.role) return res.status(401).json({ error: 'forbidden' });
    if (hasGlobalRole(user, [ROLES.SuperAdmin])) return next();
    if (typeof check === 'function') {
      if (check(user.role)) return next();
    } else if (hasOrgRole(user, [check])) {
      return next();
    }
    return res.status(403).json({ error: 'forbidden' });
  };
}

export { ROLES };
