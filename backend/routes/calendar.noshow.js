// backend/routes/calendar.noshow.js

const express = require('express');
const { requireRole, ROLES } = require('../middleware/requireRole');
const { sweepNoShow } = require('../services/calendar/noshow');

// auditLog é opcional — se não existir, viramos no-op
let auditLog = async () => {};
try {
  ({ auditLog } = require('../services/audit'));
} catch {
  // sem audit service, segue sem log
}

/**
 * Factory que registra a rota de varredura de no-show.
 * @param {{ db?: any, requireAuth: import('express').RequestHandler }} deps
 */
module.exports = ({ db, requireAuth }) => {
  const router = express.Router();

  function resolveDb(req) {
    if (req?.db) return req.db;
    if (db) return db;
    throw new Error('DB instance not provided to calendar.noshow router');
  }

  router.post(
    '/api/calendar/noshow/sweep',
    requireAuth,
    requireRole(ROLES.SuperAdmin, ROLES.OrgAdmin, ROLES.Support),
    async (req, res, next) => {
      try {
        const enabled =
          String(process.env.NOSHOW_ENABLED ?? 'true').toLowerCase() === 'true';
        if (!enabled) {
          return res.json({ ok: true, count: 0, ids: [], skipped: 'disabled' });
        }

        const grace =
          parseInt(process.env.NOSHOW_GRACE_MINUTES ?? process.env.NOSHOW_GRACE_MIN ?? '15', 10) ||
          15;

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
  );

  return router;
};
