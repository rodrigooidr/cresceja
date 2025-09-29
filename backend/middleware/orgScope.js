// middleware/orgScope.js
import { hasGlobalRole, ROLES } from '../lib/permissions.js';
import { isUuid } from '../utils/isUuid.js';

export function orgScope(req, res, next) {
  let orgId = req.user?.org_id;
  if (!orgId && hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support])) {
    const headerOrg = req.headers['x-org-id'] || null;
    orgId = isUuid(headerOrg) ? headerOrg : null;
  }
  if (!isUuid(orgId)) return res.status(401).json({ message: 'org_id missing in token' });
  req.orgId = orgId;
  req.orgScopeValidated = true;
  next();
}

