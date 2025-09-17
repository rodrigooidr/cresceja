import { Router } from 'express';
import { query } from '#db';
import Audit from '../services/audit.js';
import * as authModule from '../middleware/auth.js';
import { ensureToken } from '../services/calendar/rsvp.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

async function sendWA({ toE164, text, idempotencyKey }) {
  try {
    const res = await fetch(
      `http://127.0.0.1:${process.env.PORT || 4000}/api/whatsapp/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey || `${Date.now()}-rmd`,
        },
        body: JSON.stringify({ to: toE164, text }),
      }
    );
    return res.ok;
  } catch (err) {
    return false;
  }
}

function remindersEnabled() {
  const flag = process.env.REMINDERS_WHATSAPP_ENABLED;
  if (flag === undefined) return true;
  const normalized = String(flag).toLowerCase();
  return !['false', '0', 'no'].includes(normalized);
}

router.use(requireAuth);

router.post('/calendar/reminders/run', async (req, res, next) => {
  try {
    if (!remindersEnabled()) {
      return res.json({ ok: true, sent: 0, skipped: 'disabled' });
    }

    const requested = Number(req.body?.hours ?? 24);
    const hours = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 168) : 24;
    const now = new Date();
    const to = new Date(now.getTime() + hours * 3600 * 1000);

    const { rows } = await query(
      `
        SELECT ce.id,
               ce.org_id,
               ce.summary,
               ce.start_at,
               ce.end_at,
               ce.calendar_id,
               ce.contact_id,
               ce.rsvp_status,
               c.display_name,
               c.phone_e164
          FROM public.calendar_events ce
          LEFT JOIN public.contacts c ON c.id = ce.contact_id
         WHERE ce.start_at BETWEEN $1 AND $2
           AND ce.rsvp_status <> 'canceled'
           AND (ce.reminder_sent_at IS NULL OR ce.reminder_sent_at < NOW() - INTERVAL '10 minutes')
           AND c.phone_e164 IS NOT NULL
         ORDER BY ce.start_at ASC
         LIMIT 200
      `,
      [now.toISOString(), to.toISOString()]
    );

    const template =
      process.env.REMINDERS_WHATSAPP_TEMPLATE ||
      'Seu atendimento {summary} é {when}. Confirme: {link}';

    let sent = 0;

    for (const event of rows || []) {
      const tk = await ensureToken(event.id);
      if (!tk) continue;

      const when = new Date(event.start_at).toLocaleString();
      const base = process.env.RSVP_BASE_URL || '';
      const link = `${base}/api/calendar/rsvp?token=${encodeURIComponent(tk)}&action=confirm`;
      const text = template
        .replace('{name}', event.display_name || 'cliente')
        .replace('{summary}', event.summary || 'atendimento')
        .replace('{person}', event.calendar_id || '')
        .replace('{when}', when)
        .replace('{link}', link);

      const ok = await sendWA({
        toE164: event.phone_e164,
        text,
        idempotencyKey: `reminder:${event.id}:${hours}`,
      });

      if (ok) {
        await query(
          `UPDATE public.calendar_events SET reminder_sent_at = NOW(), reminders_count = reminders_count + 1, reminder_sent = TRUE WHERE id = $1`,
          [event.id]
        ).catch(() => {});
        sent += 1;
        await Audit?.auditLog?.(null, {
          user_email: req.user?.email || null,
          action: 'ai.calendar.reminder',
          entity: 'calendar',
          entity_id: event.id,
          payload: {
            summary: event.summary,
            contactId: event.contact_id,
            rsvp_status: event.rsvp_status,
          },
        });
      }
    }

    return res.json({ ok: true, sent, hours });
  } catch (err) {
    return next(err);
  }
});

export default router;
