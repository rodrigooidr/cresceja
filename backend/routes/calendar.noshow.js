// backend/routes/calendar.noshow.js

import express from 'express';
import * as authModule from '../middleware/auth.js';
import * as requireRoleModule from '../middleware/requireRole.js';
import { sweepNoShow } from '../services/calendar/noshow.js';

const router = express.Router();

const resolveAuth = () => {
  if (typeof authModule?.requireAuth === 'function') return authModule.requireAuth;
  if (typeof authModule?.authRequired === 'function') return authModule.authRequired;
  if (typeof authModule?.default === 'function') return authModule.default;
  return (_req, _res, next) => next();
};

const resolveRequireRole = () => {
  if (typeof requireRoleModule?.requireRole === 'function') return requireRoleModule.requireRole;
  if (typeof requireRoleModule?.default === 'function') return requireRoleModule.default;
  if (typeof requireRoleModule?.default?.requireRole === 'function') {
    return requireRoleModule.default.requireRole;
  }
  if (typeof requireRoleModule === 'function') return requireRoleModule;
  return () => (_req, _res, next) => next();
};

const resolveRoles = () => {
  if (requireRoleModule?.ROLES) return requireRoleModule.ROLES;
  if (requireRoleModule?.default?.ROLES) return requireRoleModule.default.ROLES;
  return {};
};

const requireAuth = resolveAuth();
const requireRole = resolveRequireRole();
const ROLES = resolveRoles();

// auditLog é opcional — se não existir, viramos no-op
let auditLog = async () => {};
try {
  const auditModule = await import('../services/audit.js');
  auditLog =
    typeof auditModule.auditLog === 'function'
      ? auditModule.auditLog
      : typeof auditModule.default?.auditLog === 'function'
        ? auditModule.default.auditLog
        : typeof auditModule.default === 'function'
          ? auditModule.default
          : auditLog;
} catch {
  // sem audit service, segue sem log
}

function resolveDb(req) {
  return req?.db;
}

function normalizeGraceMinutes() {
  return (
    parseInt(
      process.env.NOSHOW_GRACE_MINUTES ?? process.env.NOSHOW_GRACE_MIN ?? '15',
      10
    ) || 15
  );
}

async function sweepHandler(req, res, next) {
  try {
    const enabled = String(process.env.NOSHOW_ENABLED ?? 'true').toLowerCase() === 'true';
    if (!enabled) {
      return res.json({ ok: true, count: 0, ids: [], skipped: 'disabled' });
    }

    const grace = normalizeGraceMinutes();

    const ids = await sweepNoShow({
      db: resolveDb(req),
      graceMinutes: grace,
    });

    // audit (se disponível)
    try {
      await auditLog(resolveDb(req), {
        orgId: req.user?.orgId ?? null,
        userId: req.user?.id ?? null,
        action: 'calendar.no_show.sweep',
        entity: 'calendar_event',
        entityId: null,
        payload: { count: ids.length, ids, graceMinutes: grace },
      });
    } catch {
      // não falhar a requisição por causa do audit
    }

    return res.json({ ok: true, count: ids.length, ids });
  } catch (e) {
    return next(e);
  }
}

const sweepMiddlewares = [
  requireAuth,
  requireRole(ROLES.SuperAdmin, ROLES.OrgAdmin, ROLES.Support),
  sweepHandler,
];

['/sweep', '/api/calendar/noshow/sweep'].forEach((path) => {
  router.post(path, ...sweepMiddlewares);
});

export default router;
