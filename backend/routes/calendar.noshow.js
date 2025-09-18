import express from 'express';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import { sweepNoShow } from '../services/calendar/noshow.js';
import { auditLog } from '../services/audit.js';

export default ({ db, requireAuth }) => {
  const router = express.Router();

  router.post(
    '/api/calendar/noshow/sweep',
    requireAuth,
    requireRole(ROLES.SuperAdmin, ROLES.OrgAdmin, ROLES.Support),
    async (req, res, next) => {
      try {
        const grace = parseInt(process.env.NOSHOW_GRACE_MINUTES || '15', 10);
        const ids = await sweepNoShow({ db, graceMinutes: grace });

        await auditLog(db, {
          orgId: req.user?.orgId || null,
          userId: req.user?.id || null,
          action: 'calendar.no_show.sweep',
          entity: 'calendar_event',
          entityId: null,
          payload: { count: ids.length, ids },
        });

        res.json({ ok: true, count: ids.length, ids });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
};
