// backend/middleware/auth.js (ESM)
import jwt from "jsonwebtoken";
import { extractBearer } from './_token.js';
import {
  GLOBAL_ROLES,
  ORG_ROLES,
  ROLES,
  hasGlobalRole,
  hasOrgRole,
  normalizeGlobalRoles,
  normalizeOrgRole,
} from '../lib/permissions.js';
import { isUuid } from '../utils/isUuid.js';

/**
 * Autenticação por JWT. Preenche req.user.
 * Aceita "Authorization: Bearer <token>"
 */
const isProd = String(process.env.NODE_ENV) === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

function getToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header === 'string' && header) {
    const first = header.split(',')[0]?.trim() ?? '';
    if (/^Bearer\s+/i.test(first)) {
      const cleaned = first.replace(/^Bearer\s+/i, '').trim();
      if (cleaned) return cleaned;
    }
  }

  if (req.query?.access_token != null) {
    return String(req.query.access_token);
  }

  if (req.cookies?.access_token != null) {
    return String(req.cookies.access_token);
  }

  const bearer = extractBearer(req);
  return bearer || null;
}

function hydrateUser(payload = {}) {
  if (!payload || typeof payload !== "object") return undefined;

  const base = { ...payload };
  const orgId = base.org_id ?? base.orgId ?? base.org?.id ?? null;
  const roles = Array.isArray(base.roles)
    ? base.roles
    : base.roles
    ? [base.roles]
    : [];

  return {
    ...base,
    id:
      base.id ||
      base.sub ||
      base.user_id ||
      base.userId ||
      base.email ||
      "dev-user",
    email: base.email || base.user?.email || "dev@example.com",
    name: base.name || base.user?.name || "Dev User",
    org_id: orgId || null,
    roles,
    role: base.role || base.org_role || roles?.[0] || "OrgOwner",
  };
}

export function authRequired(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "invalid_token", message: "invalid token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = hydrateUser(payload) || undefined;
    return next();
  } catch (err) {
    if (!isProd) {
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          req.user = hydrateUser(decoded) || undefined;
          return next();
        }
      } catch {}
    }
    return res.status(401).json({ error: "invalid_token", message: "invalid token" });
  }
}

export function authOptional(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return next();

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = hydrateUser(payload) || undefined;
    } catch (err) {
      if (isProd) throw err;
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          req.user = hydrateUser(decoded) || undefined;
        }
      } catch {}
    }
  } catch {}
  return next();
}

export function normalizeRoles(req, _res, next) {
  try {
    if (req.user) {
      req.user.role = normalizeOrgRole(req.user.role);
      req.user.roles = normalizeGlobalRoles(req.user.roles);
    }
  } catch {}
  next();
}

/**
 * Guard de impersonação de organização.
 *
 * ✅ NÃO trata X-Org-Id como impersonação (é só seleção da org ativa).
 *    O pgRlsContext valida membership e prioriza o header sobre o token.
 *
 * ⛔️ Só bloqueia quando há impersonação explícita via:
 *    - X-Impersonate-Org-Id (preferencial)
 *    - X-Impersonate-Org (retrocompat)
 *
 * Somente SuperAdmin/Support (ou is_support) podem impersonar.
 * Coloque este middleware **depois** do auth e **antes** do pgRlsContext.
 */
export function guardImpersonationHeader(req, res, next) {
  // Headers de impersonação explícita (aceita variações)
  const hdrImpersonateRaw =
    req.get("X-Impersonate-Org-Id") ||
    req.get("X-Impersonate-Org") ||
    req.headers["x-impersonate-org-id"] ||
    req.headers["x-impersonate-org"] ||
    req.headers["x_impersonate_org_id"] ||
    req.headers["x_impersonate_org"] ||
    null;
  const hdrImpersonate = isUuid(hdrImpersonateRaw) ? String(hdrImpersonateRaw) : null;

  if (!req.user) {
    // Sem usuário autenticado, ignore headers de impersonação para evitar falsos positivos
    return next();
  }

  if (hdrImpersonateRaw && !hdrImpersonate) {
    return res
      .status(400)
      .json({
        error: "invalid_impersonation_org_id",
        message: "invalid impersonation org id",
      });
  }

  if (hdrImpersonate) {
    const canImpersonate = hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support]);
    if (!canImpersonate) {
      return res
        .status(403)
        .json({ error: "forbidden", message: "impersonation not allowed" });
    }
    // deixa anotado para middlewares/rotas posteriores, sem sobrescrever o token
    req.impersonatedOrgId = hdrImpersonate;
  }

  // IMPORTANTe: X-Org-Id NÃO é impersonação; deixe seguir.
  // O pgRlsContext fará o membership check e aplicará o org_id da sessão.
  return next();
}

export const impersonationGuard = guardImpersonationHeader;

/**
 * RBAC simples por papel.
 * Ex.: requireRole('OrgAgent','OrgAdmin','OrgOwner') etc.
 * SuperAdmin/is_support sempre passam.
 */
export function requireRole(...allowed) {
  const required = allowed.flat().filter(Boolean);
  return (req, res, next) => {
    const user = req.user;
    if (!user?.role)
      return res
        .status(401)
        .json({ error: "unauthenticated", message: "unauthenticated" });
    if (hasGlobalRole(user, [ROLES.SuperAdmin])) return next();
    if (!required.length) return next();

    const allowedOrgRoles = required.filter((role) => role && ORG_ROLES.includes(role));
    if (allowedOrgRoles.length && hasOrgRole(user, allowedOrgRoles)) {
      return next();
    }

    const allowedGlobalRoles = required.filter((role) => GLOBAL_ROLES.includes(role));
    if (allowedGlobalRoles.length && hasGlobalRole(user, allowedGlobalRoles)) {
      return next();
    }

    return res.status(403).json({ error: "forbidden", message: "forbidden" });
  };
}

/**
 * orgScope (se você quiser centralizar aqui).
 * Mantido para compat; no projeto atual o pgRlsContext já cuida do org_id.
 */
export function orgScope(req, res, next) {
  let orgId = req.user?.org_id;
  if (!isUuid(orgId) && hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support])) {
    const headerOrg = req.headers['x-org-id'] || null;
    if (isUuid(headerOrg)) {
      orgId = headerOrg;
    }
  }
  if (!isUuid(orgId))
    return res
      .status(401)
      .json({ error: "org_id_missing", message: "org_id missing in token" });
  req.orgId = orgId;
  req.orgScopeValidated = true;
  next();
}

/* ---- Aliases de compatibilidade com código legado ---- */
export const auth = authRequired;
export const ensureAuth = authRequired;
export const requireAuth = authRequired;

export default authRequired;
