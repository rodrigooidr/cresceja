// backend/routes/calendar.noshow.js  (ESM, export default router)
import express from 'express';
import * as authModule from '../middleware/auth.js';
import * as rolesModule from '../middleware/requireRole.js';
import { sweepNoShow } from '../services/calendar/noshow.js';

const router = express.Router();

/** Middlewares resilientes */
const requireAuth =
  (typeof authModule?.requireAuth === 'function' && authModule.requireAuth) ||
  (typeof authModule?.authRequired === 'function' && authModule.authRequired) ||
  (typeof authModule?.default === 'function' && authModule.default) ||
  ((_req, _res, next) => next());

const requireRoleFn =
  (typeof rolesModule?.requireRole === 'function' && rolesModule.requireRole) ||
  (typeof rolesModule?.default === 'function' && rolesModule.default) ||
  (typeof rolesModule === 'function' && rolesModule) ||
  // fallback: retorna um middleware que deixa passar
  (() => (_req, _res, next) => next());

const ROLES =
  (rolesModule?.ROLES) ||
  (rolesModule?.default?.ROLES) ||
  { SuperAdmin: 'SuperAdmin', OrgAdmin: 'OrgAdmin', Support: 'Support' };

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

function resolveDb(req) {
  // se você injeta db em req via middleware, aproveita aqui
  if (req?.db) return req.db;
  // se preferir forçar presença:
  // throw new Error('DB instance not available on request');
  return null;
}

/** Handler principal */
async function sweepHandler(req, res, next) {
  try {
    const enabled = String(process.env.NOSHOW_ENABLED ?? 'true').toLowerCase() === 'true';
    if (!enabled) {
      return res.json({ ok: true, count: 0, ids: [], skipped: 'disabled' });
    }

    const grace = normalizeGraceMinutes();
    const db = resolveDb(req);

    const ids = await sweepNoShow({ db, graceMinutes: grace });

    // audit (se disponível)
    try {
      const auditLog = await getAuditLog();
      await auditLog(db, {
        orgId: req.user?.orgId ?? null,
        userId: req.user?.id ?? null,
        action: 'calendar.no_show.sweep',
        entity: 'calendar_event',
        entityId: null,
        payload: { count: ids.length, ids, graceMinutes: grace },
      });
    } catch {
      // não quebra a requisição por causa do audit
    }

    return res.json({ ok: true, count: ids.length, ids });
  } catch (e) {
    return next(e);
  }
}

/** Rotas (mantém compat: caminho curto e caminho com prefixo completo) */
const guards = [requireAuth, requireRoleFn(ROLES.SuperAdmin, ROLES.OrgAdmin, ROLES.Support)];
router.post('/sweep', ...guards, sweepHandler);
router.post('/api/calendar/noshow/sweep', ...guards, sweepHandler);

export default router;
