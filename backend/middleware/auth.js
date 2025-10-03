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

function parseBearer(authz) {
  if (!authz) return null;
  const header = Array.isArray(authz) ? authz[0] : authz;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function collectToken(req) {
  const bearer = parseBearer(req.headers?.authorization ?? req.headers?.Authorization);
  const query = req.query || {};
  const tokenFromQuery = query.access_token || query.token || null;
  const tokenFromCookie =
    req.cookies?.authToken ||
    req.cookies?.token ||
    req.cookies?.access_token ||
    req.cookies?.accessToken ||
    null;

  const token = bearer || tokenFromQuery || tokenFromCookie || null;
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
  if (!req.user.role && req.user.roles.length) {
    [req.user.role] = req.user.roles;
  }
  const orgId = user.org_id || null;
  req.orgFromToken = orgId ? String(orgId) : null;
  return true;
}

function applyDevBypassUser(req, token) {
  // Em produção, só permite se ALLOW_DEV_TOKENS=1
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

export function authRequired(req, res, next) {
  try {
    req.token = null;
    req.orgFromToken = null;

    const token = collectToken(req);
    if (!token) {
      return res.status(401).json({ error: 'missing_token', message: 'missing token' });
    }

    req.token = token;

    if (applyDevBypassUser(req, token)) {
      return next();
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
    } catch (err) {
      if (!isProd && err && err.name === 'TokenExpiredError') {
        payload = jwt.decode(token);
      } else {
        return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
      }
    }

    if (!payload) {
      return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
    }

    const user = hydrateUserFromPayload(payload);
    if (!user) {
      return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
    }

    user.roles = user.roles && user.roles.length ? user.roles : payload.role ? [payload.role] : [];
    user.org_id = user.org_id || payload.org_id || payload.orgId;

    if (!user.id) {
      user.id = user.sub || user.email;
    }

    applyUser(req, user);

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', message: 'invalid token' });
  }
}

export function authOptional(req, res, next) {
  try {
    req.token = null;
    req.orgFromToken = null;

    const token = collectToken(req);
    if (!token) {
      return next();
    }

    req.token = token;

    if (applyDevBypassUser(req, token)) {
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET, DEV_VERIFY_OPTIONS);
      const user = hydrateUserFromPayload(payload) || {};
      if (!user.roles?.length && payload?.role) {
        user.roles = [payload.role];
      }
      user.org_id = user.org_id || payload?.org_id || payload?.orgId;
      if (!user.id) {
        user.id = user.sub || user.email;
      }
      applyUser(req, user);
    } catch (err) {
      if (!isProd && err && err.name === 'TokenExpiredError') {
        const payload = jwt.decode(token);
        const user = hydrateUserFromPayload(payload) || {};
        if (!user.roles?.length && payload?.role) {
          user.roles = [payload.role];
        }
        user.org_id = user.org_id || payload?.org_id || payload?.orgId;
        if (!user.id) {
          user.id = user.sub || user.email;
        }
        applyUser(req, user);
      }
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

export function guardImpersonationHeader(req, res, next) {
  const hdrImpersonateRaw =
    req.get('X-Impersonate-Org-Id') ||
    req.get('X-Impersonate-Org') ||
    req.headers['x-impersonate-org-id'] ||
    req.headers['x-impersonate-org'] ||
    req.headers['x_impersonate_org_id'] ||
    req.headers['x_impersonate_org'] ||
    null;
  const hdrImpersonate = isUuid(hdrImpersonateRaw) ? String(hdrImpersonateRaw) : null;

  if (!req.user) {
    return next();
  }

  if (hdrImpersonateRaw && !hdrImpersonate) {
    return res
      .status(400)
      .json({ error: 'invalid_impersonation_org_id', message: 'invalid impersonation org id' });
  }

  if (hdrImpersonate) {
    const canImpersonate = hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support]);
    if (!canImpersonate) {
      return res.status(403).json({ error: 'forbidden', message: 'impersonation not allowed' });
    }
    req.impersonatedOrgId = hdrImpersonate;
  }

  return next();
}

export const impersonationGuard = guardImpersonationHeader;

export function requireRole(...allowed) {
  const required = allowed.flat().filter(Boolean);
  return (req, res, next) => {
    const user = req.user;
    if (!user?.role)
      return res.status(401).json({ error: 'unauthenticated', message: 'unauthenticated' });
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

    return res.status(403).json({ error: 'forbidden', message: 'forbidden' });
  };
}

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
      .json({ error: 'org_id_missing', message: 'org_id missing in token' });

  req.org = { id: orgId };
  return next();
}

export const auth = authRequired;
export const ensureAuth = authRequired;
export const requireAuth = authRequired;
export default authRequired;
