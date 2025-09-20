// backend/routes/calendar.noshow.js  (ESM, export default router)
import express from 'express';
import * as authModule from '../middleware/auth.js';
import * as rolesModule from '../middleware/requireRole.js';
import { sweepNoShow as defaultSweepNoShow } from '../services/calendar/noshow.js';

function resolveRequireAuth(override) {
  if (typeof override === 'function') {
    return override;
  }
  return (
    (typeof authModule?.requireAuth === 'function' && authModule.requireAuth) ||
    (typeof authModule?.authRequired === 'function' && authModule.authRequired) ||
    (typeof authModule?.default === 'function' && authModule.default) ||
    ((_req, _res, next) => next())
  );
}

function resolveRequireRoleFactory(override) {
  if (typeof override === 'function') {
    return override;
  }
  return (
    (typeof rolesModule?.requireRole === 'function' && rolesModule.requireRole) ||
    (typeof rolesModule?.default === 'function' && rolesModule.default) ||
    (typeof rolesModule === 'function' && rolesModule) ||
    (() => (_req, _res, next) => next())
  );
}

function resolveRoles(overrides) {
  const baseRoles =
    rolesModule?.ROLES ||
    rolesModule?.default?.ROLES || {
      SuperAdmin: 'SuperAdmin',
      OrgAdmin: 'OrgAdmin',
      Support: 'Support',
    };
  return { ...baseRoles, ...(overrides || {}) };
}

/** Audit opcional (lazy + cache) */
let _auditCached = null;
async function getAuditLog() {
  if (_auditCached) return _auditCached;
  try {
    const mod = await import('../services/audit.js');
    _auditCached =
      mod.auditLog ||
      mod.default?.auditLog ||
      (typeof mod.default === 'function' ? mod.default : async () => {});
  } catch {
    _auditCached = async () => {};
  }
  return _auditCached;
}

/** Helpers */
function normalizeGraceMinutes() {
  return (
    parseInt(
      process.env.NOSHOW_GRACE_MINUTES ?? process.env.NOSHOW_GRACE_MIN ?? '15',
      10
    ) || 15
  );
}

function resolveDb(req, fallbackDb) {
  if (req?.db) return req.db;
  if (fallbackDb && typeof fallbackDb.query === 'function') return fallbackDb;
  return null;
}

function createSweepHandler({ defaultDb, sweepFn }) {
  return async function sweepHandler(req, res, next) {
    try {
      const enabled = String(process.env.NOSHOW_ENABLED ?? 'true').toLowerCase() === 'true';
      if (!enabled) {
        return res.json({ ok: true, count: 0, ids: [], skipped: 'disabled' });
      }

      const grace = normalizeGraceMinutes();
      const db = resolveDb(req, defaultDb);

      const ids = await (sweepFn || defaultSweepNoShow)({ db, graceMinutes: grace });

      try {
        const auditLog = await getAuditLog();
        await auditLog(db, {
          orgId: req.user?.orgId ?? req.user?.org_id ?? null,
          userId: req.user?.id ?? req.user?.user_id ?? null,
          action: 'calendar.no_show.sweep',
          entity: 'calendar_event',
          entityId: null,
          payload: { count: ids.length, ids, graceMinutes: grace },
        });
      } catch {
        // não quebra a requisição por causa do audit
      }

      return res.json({ ok: true, updated: ids.length });
    } catch (e) {
      return next(e);
    }
  };
}

export function createNoShowRouter({
  db = null,
  requireAuth: authOverride,
  requireRole: roleOverride,
  ROLES: roleOverrides,
  sweepNoShowFn = defaultSweepNoShow,
} = {}) {
  const router = express.Router();
  const requireAuth = resolveRequireAuth(authOverride);
  const requireRoleFactory = resolveRequireRoleFactory(roleOverride);
  const roles = resolveRoles(roleOverrides);
  const sweepHandler = createSweepHandler({ defaultDb: db, sweepFn: sweepNoShowFn });
  const guards = [requireAuth, requireRoleFactory(roles.SuperAdmin, roles.OrgAdmin, roles.Support)];

  router.post('/sweep', ...guards, sweepHandler);
  router.post('/calendar/noshow/sweep', ...guards, sweepHandler);
  router.post('/api/calendar/noshow/sweep', ...guards, sweepHandler);

  return router;
}

const defaultRouter = createNoShowRouter();

export default defaultRouter;
