// backend/middleware/auth.js (ESM)
import jwt from "jsonwebtoken";
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
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEV_VERIFY_OPTIONS = isProd ? undefined : { ignoreExpiration: true };
const DEV_BYPASS_TOKENS = new Set(['dev-change-me', 'dev', 'local']);

function maskToken(token) {
  if (!token) return '(empty)';
  const str = String(token);
  if (str.length <= 6) return `${str.slice(0, 2)}***`;
  return `${str.slice(0, 3)}***${str.slice(-2)}`;
}

function debugTokenSource(source, token) {
  if (isProd) return;
  if (process.env.DEBUG_AUTH !== '1') return;
  try {
    // eslint-disable-next-line no-console
    console.log('[auth]', { source, token: maskToken(token) });
  } catch {}
}

function getToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header === 'string' && header) {
    const first = header.split(',')[0]?.trim() ?? '';
    if (/^Bearer\s+/i.test(first)) {
      const cleaned = first.replace(/^Bearer\s+/i, '').trim();
      if (cleaned) {
        debugTokenSource('header', cleaned);
        return cleaned;
      }
    }
  }

  const queryToken =
    req.query?.access_token ??
    req.query?.accessToken ??
    req.query?.token ??
    null;
  if (queryToken != null && queryToken !== '') {
    const token = String(queryToken).trim();
    if (token) {
      debugTokenSource('query', token);
      return token;
    }
  }

  const cookieToken =
    req.cookies?.authToken ??
    req.cookies?.token ??
    req.cookies?.access_token ??
    req.cookies?.accessToken ??
    null;
  if (cookieToken != null && cookieToken !== '') {
    const token = String(cookieToken).trim();
    if (token) {
      debugTokenSource('cookie', token);
      return token;
    }
  }

  return null;
}

function resolveOrgOverride(req) {
  const header = req.get?.('x-org-id') ?? req.headers?.['x-org-id'];
  if (header) return header;
  const fromQuery = req.query?.orgId ?? req.query?.org_id;
  if (fromQuery) return fromQuery;
  const fromCookie = req.cookies?.orgId ?? req.cookies?.org_id;
  if (fromCookie) return fromCookie;
  return null;
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

function applyUserFromPayload(req, payload, source = 'verified') {
  const user = hydrateUser(payload);
  if (!user) return false;
  req.user = user;
  const orgFromToken =
    user.org_id ??
    user.orgId ??
    (user.org && (user.org.id || user.org.org_id)) ??
    null;
  req.orgFromToken = orgFromToken != null && orgFromToken !== '' ? String(orgFromToken) : null;
  if (!isProd && process.env.DEBUG_AUTH === '1') {
    try {
      // eslint-disable-next-line no-console
      console.log('[auth:user]', { source, orgFromToken: req.orgFromToken || null });
    } catch {}
  }
  return true;
}

function applyDevBypassUser(req, token) {
  if (!token || isProd || !DEV_BYPASS_TOKENS.has(token)) return false;

  const orgOverride = resolveOrgOverride(req);
  const orgId = orgOverride != null && orgOverride !== '' ? String(orgOverride) : null;

  req.user = {
    id: 'dev-user',
    email: 'dev@local',
    name: 'Dev User',
    role: 'SuperAdmin',
    roles: ['SuperAdmin'],
    org_id: orgId,
    orgId,
    is_superadmin: true,
    _devBypass: true,
  };
  req.orgFromToken = orgId;
  return true;
}

export function authRequired(req, res, next) {
  req.orgFromToken = null;
  req.token = null;

  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'missing_token', message: 'missing token' });
  }

  req.token = token;

  if (applyDevBypassUser(req, token)) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
    if (applyUserFromPayload(req, payload, 'verified')) {
      return next();
    }
  } catch {}

  return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
}

export function authOptional(req, res, next) {
  try {
    req.orgFromToken = null;
    req.token = null;
    const token = getToken(req);
    if (!token) {
      return next();
    }

    req.token = token;

    if (applyDevBypassUser(req, token)) {
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
      applyUserFromPayload(req, payload, 'verified');
    } catch {}
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
