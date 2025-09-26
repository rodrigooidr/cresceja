// middleware/orgScope.js
import { hasGlobalRole, ROLES } from '../lib/permissions.js';

export function orgScope(req, res, next) {
  let orgId = req.user?.org_id;
  if (!orgId && hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support])) {
    orgId = req.headers['x-org-id'] || null;
  }
  if (!orgId) return res.status(401).json({ message: 'org_id missing in token' });
  req.orgId = orgId;
  next();
}

