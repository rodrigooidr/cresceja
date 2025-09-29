// Impersonação de Org por Support/SuperAdmin com auditoria

import { ROLES, SUPPORT_SCOPES, hasGlobalRole } from '../lib/permissions.js';
import { query } from '#db';
import { isUuid } from '../utils/isUuid.js';

export async function impersonation(req, res, next) {
  try {
    const user = req.user;
    if (!user) return next();

    // orgId padrão vem do token
    const defaultOrgId = user.impersonated_org_id || user.org_id || null;
    req.orgId = isUuid(defaultOrgId) ? defaultOrgId : null;
    req.impersonating = false;

    // Cabeçalho ou query para impersonação (uso somente por Support/SuperAdmin)
    const headerOrgRaw = req.header('x-impersonate-org-id') || req.query.impersonate_org_id;
    const headerOrg = isUuid(headerOrgRaw) ? headerOrgRaw : null;

    if (headerOrgRaw) {
      const canImpersonate =
        hasGlobalRole(user, [ROLES.SuperAdmin]) ||
        (hasGlobalRole(user, [ROLES.Support]) && user.support_scopes?.includes(SUPPORT_SCOPES.impersonate));
      if (canImpersonate) {
        if (!headerOrg) {
          return res.status(400).json({ error: 'invalid_impersonation_org_id' });
        }
        req.orgId = headerOrg;
        req.orgScopeValidated = true;
        req.impersonating = true;

        // Auditoria
        await query(
          `INSERT INTO support_audit_logs (actor_user_id, target_org_id, path, method, created_at)
           VALUES ($1,$2,$3,$4, now())`,
          [user.sub || user.id, headerOrg, req.originalUrl, req.method]
        );
      } else {
        return res.status(403).json({ error: 'impersonation_not_allowed' });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
