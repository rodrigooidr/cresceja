import { Router } from 'express';
import { query } from '#db';
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
          'Idempotency-Key': idempotencyKey || `${Date.now()}-one`,
        },
        body: JSON.stringify({ to: toE164, text }),
      }
    );
    return res.ok === true;
  } catch (err) {
    return false;
  }
}

router.post('/calendar/events/:id/remind', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
        SELECT ce.id,
               ce.summary,
               ce.start_at,
               ce.calendar_id,
               c.display_name,
               c.phone_e164
          FROM public.calendar_events ce
          LEFT JOIN public.contacts c ON c.id = ce.contact_id
         WHERE ce.id = $1
         LIMIT 1
      `,
      [id]
    );
    const event = result.rows?.[0];
    if (!event || !event.phone_e164) {
      return res.status(404).json({ ok: false, error: 'not_found_or_no_phone' });
    }

    const token = await ensureToken(id);
    const when = new Date(event.start_at).toLocaleString();
    const template =
      process.env.REMINDERS_WHATSAPP_TEMPLATE ||
      'Seu atendimento {summary} é {when}. Confirme: {link}';
    const link = `${process.env.RSVP_BASE_URL || ''}/api/calendar/rsvp?token=${encodeURIComponent(
      token || ''
    )}&action=confirm`;
    const text = template
      .replace('{name}', event.display_name || 'cliente')
      .replace('{summary}', event.summary || 'atendimento')
      .replace('{person}', event.calendar_id || '')
      .replace('{when}', when)
      .replace('{link}', link);

    const ok = await sendWA({
      toE164: event.phone_e164,
      text,
      idempotencyKey: `remind-one:${id}`,
    });

    if (ok) {
      await query(
        `UPDATE public.calendar_events SET reminder_sent_at = NOW(), reminders_count = reminders_count + 1 WHERE id = $1`,
        [id]
      );
      return res.json({ ok: true });
    }

    return res.status(502).json({ ok: false, error: 'wa_send_failed' });
  } catch (err) {
    return next(err);
  }
});

export default router;
