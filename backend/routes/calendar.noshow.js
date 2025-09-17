import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';

const router = Router();

const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.post('/calendar/noshow/sweep', requireAuth, async (req, res, next) => {
  try {
    if (String(process.env.NOSHOW_ENABLED).toLowerCase() !== 'true') {
      return res.json({ ok: true, updated: 0, skipped: 'disabled' });
    }
    const grace = Number(process.env.NOSHOW_GRACE_MIN || 15);
    const result = await query(
      `
        UPDATE public.calendar_events
           SET rsvp_status = 'noshow', noshow_at = NOW()
         WHERE rsvp_status = 'pending'
           AND start_at < NOW() - make_interval(mins := $1::int)
           AND (canceled_at IS NULL)
         RETURNING id
      `,
      [grace]
    );
    return res.json({ ok: true, updated: result.rowCount || 0 });
  } catch (err) {
    return next(err);
  }
});

export default router;
