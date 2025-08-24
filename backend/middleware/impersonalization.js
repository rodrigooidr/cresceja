// Impersonação de Org por Support/SuperAdmin com auditoria

import { ROLES, SUPPORT_SCOPES } from '../lib/permissions.js';
import { query } from '../config/db.js';

export async function impersonation(req, res, next) {
  try {
    const user = req.user;
    if (!user) return next();

    // orgId padrão vem do token
    req.orgId = user.impersonated_org_id || user.org_id || null;
    req.impersonating = false;

    // Cabeçalho ou query para impersonação (uso somente por Support/SuperAdmin)
    const headerOrg = req.header('x-impersonate-org-id') || req.query.impersonate_org_id;

    if (headerOrg) {
      if (user.role === ROLES.SuperAdmin || (user.is_support && user.support_scopes?.includes(SUPPORT_SCOPES.impersonate))) {
        req.orgId = headerOrg;
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
