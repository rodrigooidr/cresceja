// backend/middleware/auth.js (ESM)
import jwt from "jsonwebtoken";

export const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ===== Assinatura de token (use no login) =====
export function signToken(payload) {
  // payload esperado: { sub, org_id, role, perms, is_support, support_scopes }
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

// ===== Normalização do payload =====
function normalize(decoded) {
  const sub = decoded.sub ?? decoded.id ?? decoded.user_id ?? null;
  return {
    ...decoded,
    sub,
    id: sub, // compat
    org_id: decoded.org_id ?? null,
    role: decoded.role ?? "OrgViewer",
    perms: decoded.perms ?? {},
    is_support: !!decoded.is_support,
    support_scopes: decoded.support_scopes ?? [],
    impersonated_org_id: decoded.impersonated_org_id ?? null,
  };
}

// ===== Auth (opcional/obrigatório) =====
export function authOptional(req, _res, next) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tok) {
    try {
      const decoded = jwt.verify(tok, SECRET);
      req.user = normalize(decoded);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: "no_token" });
  try {
    const decoded = jwt.verify(tok, SECRET);
    req.user = normalize(decoded);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

// ===== Constantes de RBAC/Scopes =====
export const ROLES = Object.freeze({
  OrgViewer: "OrgViewer",
  OrgAgent: "OrgAgent",
  OrgAdmin: "OrgAdmin",
  OrgOwner: "OrgOwner",
  Support: "Support",
  SuperAdmin: "SuperAdmin",
});

export const SUPPORT_SCOPES = Object.freeze({
  impersonate: "impersonate",
  inboxWrite: "inboxWrite",
  crmWrite: "crmWrite",
  marketingDraft: "marketingDraft",
  marketingPublish: "marketingPublish",
  approveContent: "approveContent",
  channelsManage: "channelsManage",
  billingRead: "billingRead", // nunca write
  governanceRead: "governanceRead",
  attachmentsWrite: "attachmentsWrite",
  orgsManage: "orgsManage",
});

// ===== Guards de rota =====
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthenticated" });

    // SuperAdmin sempre pode
    if (user.role === ROLES.SuperAdmin) return next();

    // Support: só entra se a rota explicitamente permitir Support
    if (user.is_support) {
      if (allowedRoles.includes(ROLES.Support)) return next();
      return res.status(403).json({ error: "support_scope_required" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

export function requireScope(scope) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthenticated" });

    if (user.role === ROLES.SuperAdmin) return next();
    if (user.is_support && (user.support_scopes || []).includes(scope)) return next();

    return res.status(403).json({ error: "scope_forbidden", scope });
  };
}

// ===== Impersonação (definir req.orgId lendo header) =====
// Use após authRequired. Se houver header, valida permissão.
// Sem header: usa org_id do token. Sinaliza req.impersonating = true/false.
export function impersonationGuard(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "unauthenticated" });

  const headerOrg =
    req.header("x-impersonate-org-id") || req.query.impersonate_org_id;

  // valor padrão da org na requisição
  req.orgId = user.impersonated_org_id || user.org_id || null;
  req.impersonating = false;

  if (!headerOrg) return next();

  const canImpersonate =
    user.role === ROLES.SuperAdmin ||
    (user.is_support &&
      (user.support_scopes || []).includes(SUPPORT_SCOPES.impersonate));

  if (!canImpersonate) {
    return res.status(403).json({ error: "impersonation_not_allowed" });
  }

  req.orgId = headerOrg;
  req.impersonating = true;
  next();
}
