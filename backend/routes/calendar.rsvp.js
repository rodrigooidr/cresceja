import { Router } from 'express';
import { markRSVPByToken } from '../services/calendar/rsvp.js';
import { query } from '#db';

const router = Router();

router.all('/calendar/rsvp', async (req, res) => {
  try {
    const token = req.query.token || req.body?.token;
    const actionRaw = req.query.action || req.body?.action;
    const action = String(actionRaw || '').toLowerCase();
    if (!token || !['confirm', 'cancel', 'noshow'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'invalid_params' });
    }

    const status = action === 'confirm' ? 'confirmed' : action === 'cancel' ? 'canceled' : 'noshow';
    const event = await markRSVPByToken(token, status);
    if (!event) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    const conv = await query(
      `
        SELECT id
          FROM public.conversations
         WHERE contact_id = $1 AND org_id = $2
         ORDER BY updated_at DESC
         LIMIT 1
      `,
      [event.contact_id, event.org_id]
    );

    const conversationId = conv.rows?.[0]?.id;
    if (conversationId) {
      await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/inbox/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          text: `RSVP: ${status}`,
          meta: { system: true, type: 'calendar.rsvp', status },
        }),
      }).catch(() => {});
    }

    return res.json({ ok: true, status });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
});

export default router;
