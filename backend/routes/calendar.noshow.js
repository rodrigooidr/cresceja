import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import { sweepNoShow } from '../services/calendar/noshow.js';

const router = Router();

const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

function resolveDb(req) {
  if (req?.db && typeof req.db.query === 'function') return req.db;
  return { query: (text, params) => query(text, params) };
}

router.post('/calendar/noshow/sweep', requireAuth, async (req, res, next) => {
  try {
    if (String(process.env.NOSHOW_ENABLED).toLowerCase() !== 'true') {
      return res.json({ ok: true, updated: 0, skipped: 'disabled' });
    }

    const grace = Number(process.env.NOSHOW_GRACE_MIN || 15);
    const ids = await sweepNoShow({ db: resolveDb(req), graceMinutes: grace });
    return res.json({ ok: true, updated: ids.length });
  } catch (err) {
    return next(err);
  }
});

export default router;
