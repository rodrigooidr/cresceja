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
export function impersonationGuard(req, res, next) {
  // Headers de impersonação explícita (aceita variações)
  const hdrImpersonate =
    req.get("X-Impersonate-Org-Id") ||
    req.get("X-Impersonate-Org") ||
    req.headers["x-impersonate-org-id"] ||
    req.headers["x-impersonate-org"] ||
    req.headers["x_impersonate_org_id"] ||
    req.headers["x_impersonate_org"] ||
    null;

  if (hdrImpersonate) {
    const role = req.user?.role || "user";
    const isSupport = !!req.user?.is_support;
    const canImpersonate = isSupport || ["SuperAdmin", "Support"].includes(role);
    if (!canImpersonate) {
      return res.status(403).json({ message: "impersonation not allowed" });
    }
    // deixa anotado para middlewares/rotas posteriores, sem sobrescrever o token
    req.impersonatedOrgId = String(hdrImpersonate);
  }

  // IMPORTANTe: X-Org-Id NÃO é impersonação; deixe seguir.
  // O pgRlsContext fará o membership check e aplicará o org_id da sessão.
  return next();
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
 * orgScope (se você quiser centralizar aqui).
 * Mantido para compat; no projeto atual o pgRlsContext já cuida do org_id.
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
