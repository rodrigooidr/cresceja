import { Router } from 'express';
import { query } from '#db';
import Audit from '../services/audit.js';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

const TZ = process.env.CALENDAR_TIMEZONE || 'America/Sao_Paulo';

router.use(requireAuth);

router.post('/calendar/reminders/run', async (req, res, next) => {
  try {
    const requested = Number(req.body?.hours || 24);
    const hours = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 168) : 24;
    const tzSafe = TZ.replace(/'/g, "''");
    const nowExpr = `timezone('${tzSafe}', now())`;

    const sql = `
      SELECT id,
             COALESCE(title, summary) AS summary,
             start_at,
             contact_id
        FROM public.calendar_events
       WHERE start_at BETWEEN ${nowExpr} AND (${nowExpr} + interval '${hours} hours')
         AND (reminder_sent IS DISTINCT FROM TRUE OR reminder_sent IS NULL)
    `;

    const { rows } = await query(sql);

    for (const event of rows) {
      await query(`UPDATE public.calendar_events SET reminder_sent = TRUE, updated_at = now() WHERE id = $1`, [event.id]).catch(() => {});
      await Audit.auditLog(null, {
        user_email: req.user?.email || null,
        action: 'ai.calendar.reminder',
        entity: 'calendar',
        entity_id: event.id,
        payload: { summary: event.summary, contactId: event.contact_id },
      });
    }

    res.json({ processed: rows.length });
  } catch (err) {
    next(err);
  }
});

export default router;
