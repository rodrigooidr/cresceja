// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
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

const isProd = String(process.env.NODE_ENV) === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEV_VERIFY_OPTIONS = isProd ? undefined : { ignoreExpiration: true };
const DEV_BYPASS_TOKENS = new Set(['dev-change-me', 'dev', 'local']);
const allowDevTokens = String(process.env.ALLOW_DEV_TOKENS || '') === '1';
const CLOCK_SKEW_SECONDS = 60;

/* ---------- utils ---------- */
function parseBearer(authz) {
  if (!authz) return null;
  const header = Array.isArray(authz) ? authz[0] : authz;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function extractToken(req) {
  const headerAuth =
    (typeof req.get === 'function' ? req.get('authorization') : undefined) ||
    req.headers?.authorization ||
    req.headers?.Authorization;
  if (typeof headerAuth === 'string' && headerAuth.toLowerCase().startsWith('bearer ')) {
    const candidate = headerAuth.slice(7).trim();
    if (candidate) return candidate;
  }

  const q = req.query || {};
  const fromQuery = q.access_token || q.token || q.accessToken || null;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }

  const cookieCandidates = [
    req.cookies?.access_token,
    req.cookies?.accessToken,
    req.cookies?.authToken,
    req.cookies?.token,
  ];
  for (const candidate of cookieCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function collectToken(req) {
  const direct = extractToken(req);
  if (direct) return direct;

  const bearer = parseBearer(req.headers?.authorization ?? req.headers?.Authorization);
  const q = req.query || {};
  const fromQuery = q.access_token || q.token || null;
  const fromCookie =
    req.cookies?.authToken ||
    req.cookies?.token ||
    req.cookies?.access_token ||
    req.cookies?.accessToken ||
    null;

  const token = bearer || fromQuery || fromCookie || null;
  if (token == null) return null;
  const str = String(token).trim();
  return str || null;
}

function resolveDevOrg(req) {
  return (
    req.headers?.['x-org-id'] ||
    req.query?.orgId ||
    req.query?.org_id ||
    req.cookies?.orgId ||
    req.cookies?.org_id ||
    null
  );
}

function hydrateUserFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : payload.role
    ? [payload.role]
    : [];
  return {
    id: payload.id || payload.sub,
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    roles,
    role: payload.role || (roles.length ? roles[0] : undefined),
    org_id: payload.org_id || payload.orgId,
  };
}

function applyUser(req, user) {
  if (!user) return false;
  req.user = {
    ...user,
    roles: Array.isArray(user.roles) ? user.roles : [],
  };
  if (!req.user.role && req.user.roles.length) [req.user.role] = req.user.roles;
  const orgId = user.org_id || null;
  req.orgFromToken = orgId ? String(orgId) : null;
  return true;
}

function applyDevBypassUser(req, token) {
  // Em produção só habilita se ALLOW_DEV_TOKENS=1; em dev sempre.
  if (!token || (!allowDevTokens && isProd) || !DEV_BYPASS_TOKENS.has(token)) return false;

  const rawOrg = resolveDevOrg(req);
  const orgId = rawOrg != null && String(rawOrg).trim() !== '' ? String(rawOrg).trim() : null;
  req.user = {
    _devBypass: true,
    id: 'dev-user',
    sub: 'dev-user',
    email: 'dev@local',
    name: 'Dev SuperAdmin',
    role: 'SuperAdmin',
    roles: ['SuperAdmin'],
    org_id: orgId || undefined,
  };
  req.orgFromToken = orgId ? String(orgId) : null;
  return true;
}

/* ---------- middlewares principais ---------- */
export function authRequired(req, res, next) {
  try {
    req.token = null;
    req.orgFromToken = null;

    const token = collectToken(req);
    if (!token) return res.status(401).json({ error: 'missing_token', message: 'missing token' });
    req.token = token;

    if (applyDevBypassUser(req, token)) return next();

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
    } catch (err) {
      if (!isProd && err?.name === 'TokenExpiredError') {
        payload = jwt.decode(token);
      } else {
        return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
      }
    }

    const user = hydrateUserFromPayload(payload);
    if (!user) return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });

    user.roles = user.roles?.length ? user.roles : payload.role ? [payload.role] : [];
    user.org_id = user.org_id || payload?.org_id || payload?.orgId;
    if (!user.id) user.id = user.sub || user.email;

    applyUser(req, user);
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
  }
}

export function authOptional(req, _res, next) {
  try {
    req.token = null;
    req.orgFromToken = null;

    const token = collectToken(req);
    if (!token) return next();
    req.token = token;

    if (applyDevBypassUser(req, token)) return next();

    try {
      const payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
      const user = hydrateUserFromPayload(payload) || {};
      if (!user.roles?.length && payload?.role) user.roles = [payload.role];
      user.org_id = user.org_id || payload?.org_id || payload?.orgId;
      if (!user.id) user.id = user.sub || user.email;
      applyUser(req, user);
    } catch (err) {
      // Em dev, aceita expirado
      if (!isProd && err?.name === 'TokenExpiredError') {
        const payload = jwt.decode(token);
        const user = hydrateUserFromPayload(payload) || {};
        if (!user.roles?.length && payload?.role) user.roles = [payload.role];
        user.org_id = user.org_id || payload?.org_id || payload?.orgId;
        if (!user.id) user.id = user.sub || user.email;
        applyUser(req, user);
      }
    }
  } catch {}
  return next();
}

export function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (applyDevBypassUser(req, token)) {
    req.auth = {
      sub: req.user?.sub || req.user?.id || 'dev-user',
      org_id: req.orgFromToken || undefined,
      role: req.user?.role || req.user?.roles || 'SuperAdmin',
      scope: ['whatsapp_qr'],
    };
    return next();
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    if (payload?.exp && now > payload.exp + CLOCK_SKEW_SECONDS) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (payload?.iat && now < payload.iat - CLOCK_SKEW_SECONDS) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    req.token = token;
    req.auth = payload;

    const user = hydrateUserFromPayload(payload);
    if (user) {
      applyUser(req, user);
      if (user.org_id && !req.org) req.org = { id: user.org_id };
    }
    if (!req.orgFromToken && payload?.org_id) {
      req.orgFromToken = String(payload.org_id);
    }
    if (!req.orgId && payload?.org_id) {
      req.orgId = String(payload.org_id);
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

function hasScope(payload, needed) {
  if (!payload) return false;
  const raw = Array.isArray(payload.scope)
    ? payload.scope
    : typeof payload.scope === 'string'
    ? payload.scope.split(/[\s,]+/).filter(Boolean)
    : [];
  return raw.includes(needed);
}

function hasRole(payload, roles) {
  if (!payload) return false;
  const direct = Array.isArray(payload.role)
    ? payload.role
    : payload.role
    ? [payload.role]
    : [];
  const many = Array.isArray(payload.roles) ? payload.roles : [];
  const userRoles = Array.from(new Set([...direct, ...many].map((role) => String(role))));
  return userRoles.some((role) => roles.includes(role));
}

export function requireWhatsAppQrPermission(req, res, next) {
  const payload = req.auth;
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!hasScope(payload, 'whatsapp_qr')) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (!hasRole(payload, ['SuperAdmin', 'OrgOwner'])) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const orgFromReq =
    (typeof req.query?.orgId === 'string' && req.query.orgId) ||
    (typeof req.query?.org_id === 'string' && req.query.org_id) ||
    req.headers?.['x-org-id'];
  if (orgFromReq && payload.org_id && String(orgFromReq) !== String(payload.org_id)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (payload.org_id && !req.orgId) {
    req.orgId = String(payload.org_id);
  }
  if (payload.org_id && !req.org) {
    req.org = { id: String(payload.org_id) };
  }

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

export function guardImpersonationHeader(req, res, next) {
  const raw =
    req.get('X-Impersonate-Org-Id') ||
    req.get('X-Impersonate-Org') ||
    req.headers['x-impersonate-org-id'] ||
    req.headers['x-impersonate-org'] ||
    req.headers['x_impersonate_org_id'] ||
    req.headers['x_impersonate_org'] ||
    null;

  const hdrImpersonate = isUuid(raw) ? String(raw) : null;

  if (!req.user) return next();

  if (raw && !hdrImpersonate) {
    return res
      .status(400)
      .json({ error: 'invalid_impersonation_org_id', message: 'invalid impersonation org id' });
  }

  if (hdrImpersonate) {
    const can = hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support]);
    if (!can) return res.status(403).json({ error: 'forbidden', message: 'impersonation not allowed' });
    req.impersonatedOrgId = hdrImpersonate;
  }
  return next();
}
export const impersonationGuard = guardImpersonationHeader;

export function requireRole(...allowed) {
  const required = allowed.flat().filter(Boolean);
  return (req, res, next) => {
    const user = req.user;
    if (!user?.role) return res.status(401).json({ error: 'unauthenticated' });

    // SuperAdmin sempre passa
    if (hasGlobalRole(user, [ROLES.SuperAdmin])) return next();
    if (!required.length) return next();

    const orgRoles = required.filter((r) => ORG_ROLES.includes(r));
    if (orgRoles.length && hasOrgRole(user, orgRoles)) return next();

    const globalRoles = required.filter((r) => GLOBAL_ROLES.includes(r));
    if (globalRoles.length && hasGlobalRole(user, globalRoles)) return next();

    return res.status(403).json({ error: 'forbidden' });
  };
}

export function requireSuperAdmin(req, res, next) {
  // helper equivalente ao arquivo wrapper
  if (hasGlobalRole(req.user, [ROLES.SuperAdmin])) return next();
  return res.status(403).json({ error: 'forbidden' });
}

export function orgScope(req, res, next) {
  let orgId = req.user?.org_id;

  // SuperAdmin/Support podem “injetar” org via header X-Org-Id
  if (!isUuid(orgId) && hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support])) {
    const headerOrg = req.headers['x-org-id'] || null;
    if (isUuid(headerOrg)) orgId = headerOrg;
  }

  if (!isUuid(orgId)) {
    return res.status(401).json({ error: 'org_id_missing', message: 'org_id missing in token' });
  }

  req.org = { id: orgId };
  return next();
}

/* ---------- aliases de export ---------- */
export const auth = authRequired;
export const ensureAuth = authRequired;
export const requireAuth = authRequired;
export default authRequired;
