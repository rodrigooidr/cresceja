// backend/middleware/auth.js (ESM)
import jwt from "jsonwebtoken";

/**
 * Autenticação por JWT. Preenche req.user.
 * Aceita "Authorization: Bearer <token>"
 */
export function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const [scheme, token] = h.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "missing token" });
    }
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const payload = jwt.verify(token, secret);
    if (!payload.id && payload.sub) payload.id = payload.sub; // compat
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "invalid token" });
  }
}

/**
 * Guard de impersonação de organização.
 * Permite a usuários com papel elevado (SuperAdmin ou is_support)
 * "assumirem" uma organização via header X-Org-Id (ou X-Impersonate-Org).
 * Coloque este middleware **depois** do auth e **antes** do orgScope.
 */
export function impersonationGuard(req, res, next) {
  // aceita cabeçalho em diferentes formas
  const headerOrg =
    req.headers["x-org-id"] ||
    req.headers["x-impersonate-org"] ||
    req.headers["x_org_id"] ||
    null;

  if (!headerOrg) return next(); // nada a fazer

  const elevated = req.user?.role === "SuperAdmin" || !!req.user?.is_support;
  if (!elevated) {
    return res.status(403).json({ message: "impersonation not allowed" });
  }

  // aplica impersonação
  req.user.org_id = String(headerOrg);
  req.user.impersonated_org_id = String(headerOrg);
  next();
}

/**
 * RBAC simples por papel.
 * Ex.: requireRole('OrgAgent','OrgAdmin','OrgOwner') etc.
 * SuperAdmin/is_support sempre passam.
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: "unauthenticated" });
    if (role === "SuperAdmin" || req.user?.is_support) return next();
    if (!allowed || allowed.length === 0) return next();
    if (allowed.includes(role)) return next();
    return res.status(403).json({ message: "forbidden" });
  };
}

/**
 * orgScope (se você quiser centralizar aqui)
 * Falha com 401 se não houver org_id (após possível impersonação).
 */
export function orgScope(req, res, next) {
  const orgId = req.user?.org_id;
  if (!orgId) return res.status(401).json({ message: "org_id missing in token" });
  req.orgId = orgId;
  next();
}

/* ---- Aliases de compatibilidade com código legado ---- */
export const authRequired = auth;
export const ensureAuth = auth;
export const requireAuth = auth;

export default auth;
