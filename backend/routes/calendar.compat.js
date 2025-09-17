import http from 'node:http';
import { Router } from 'express';
import Calendar from '../services/calendar/google.js';
import Audit from '../services/audit.js';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

const TZ = process.env.CALENDAR_TIMEZONE || 'America/Sao_Paulo';
const LEAD = Number(process.env.CALENDAR_LEAD_TIME_MIN || 120);
const SLOT = Number(process.env.CALENDAR_SLOT_DEFAULT_MIN || 30);
const SUGG = Number(process.env.CALENDAR_SUGGESTION_COUNT || 3);

router.use(requireAuth);

function fetchLocal(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        path,
        host: '127.0.0.1',
        port: process.env.PORT || 4000,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

router.get('/calendar/calendars', async (req, res, next) => {
  try {
    const items = await Calendar.listCalendars(req.user?.org_id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/calendar/services', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT collect_fields FROM public.org_ai_settings WHERE org_id = $1`,
      [req.user?.org_id],
    );
    const services =
      rows[0]?.collect_fields?.appointment_services || [
        { name: 'Consulta', durationMin: 30, defaultSkill: 'consulta' },
        { name: 'Mentoria', durationMin: 60, defaultSkill: 'mentoria' },
        { name: 'Avaliação', durationMin: 45, defaultSkill: 'avaliacao' },
      ];
    res.json({ items: services });
  } catch (err) {
    next(err);
  }
});

router.get('/calendar/availability', async (req, res, next) => {
  try {
    const { personName = null, skill = null, from, to } = req.query;
    const out = await Calendar.getAvailability({
      orgId: req.user?.org_id,
      personName,
      skill,
      from,
      to,
      durationMin: SLOT,
      leadMin: LEAD,
      tz: TZ,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.get('/calendar/suggest', async (req, res, next) => {
  try {
    const { personName = null, skill = null, fromISO, durationMin } = req.query;
    const out = await Calendar.suggest({
      orgId: req.user?.org_id,
      personName,
      skill,
      fromISO,
      durationMin: Number(durationMin || SLOT),
      count: SUGG,
      tz: TZ,
      leadMin: LEAD,
    });
    res.json({ items: out });
  } catch (err) {
    next(err);
  }
});

router.post('/calendar/events', async (req, res, next) => {
  try {
    const idem = req.get('Idempotency-Key') || null;
    const event = await Calendar.createEvent({
      orgId: req.user?.org_id,
      tz: TZ,
      idem,
      ...req.body,
    });

    await Audit.auditLog(null, {
      user_email: req.user?.email || null,
      action: 'ai.calendar.create',
      entity: 'calendar',
      entity_id: event.id,
      payload: { summary: event.summary },
    });

    if (req.body?.contactId) {
      await query(
        `
          UPDATE public.clients
             SET status = 'Agendado',
                 updated_at = now()
           WHERE id = (
                  SELECT client_id
                    FROM public.contacts
                   WHERE id = $1
                 )
        `,
        [req.body.contactId]
      ).catch(() => {});
    }

    const startAt =
      typeof event.start === 'string'
        ? event.start
        : event.start?.dateTime || event.start?.date || null;
    const endAt =
      typeof event.end === 'string'
        ? event.end
        : event.end?.dateTime || event.end?.date || null;

    try {
      await query(
        `
    INSERT INTO public.calendar_events (id, org_id, summary, description, start_at, end_at, provider, external_event_id, calendar_id, contact_id, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'google', $6, $7, $8, now())
    ON CONFLICT DO NOTHING
  `,
        [
          req.user?.org_id,
          event.summary,
          event.description || null,
          startAt,
          endAt,
          event.id,
          event.calendarId,
          req.body.contactId || null,
        ],
      ).catch(() => {});

      if (req.body.conversationId) {
        const meta = { system: true, type: 'calendar.booked', link: event.htmlLink || null };
        await fetchLocal('POST', '/api/inbox/messages', {
          conversationId: req.body.conversationId,
          text: `Agendado: ${event.summary} — ${startAt ? new Date(startAt).toLocaleString() : ''} → ${endAt ? new Date(endAt).toLocaleTimeString() : ''}`,
          meta,
        }).catch(() => {});
      }
    } catch (e) {
      /* no-op */
    }

    res.json(event);
  } catch (err) {
    next(err);
  }
});

router.get('/calendar/events', requireAuth, async (req, res, next) => {
  try {
    const { from, to, personName = null } = req.query;
    const rows = await query(
      `
      SELECT id, summary, description, start_at, end_at, external_event_id, calendar_id, contact_id
      FROM public.calendar_events
      WHERE ($1::timestamptz IS NULL OR start_at >= $1)
        AND ($2::timestamptz IS NULL OR end_at   <= $2)
        AND ($3::text IS NULL OR calendar_id IN (
          SELECT COALESCE(external_account_id, username)
          FROM public.channel_accounts
          WHERE org_id=$4 AND channel='google_calendar' AND lower(name)=lower($3)
        ))
      ORDER BY start_at ASC
    `,
      [from || null, to || null, personName || null, req.user?.org_id],
    );
    res.json({ items: rows.rows || [] });
  } catch (e) {
    next(e);
  }
});

router.patch('/calendar/events/:id', async (req, res, next) => {
  try {
    const event = await Calendar.updateEvent({
      orgId: req.user?.org_id,
      id: req.params.id,
      tz: TZ,
      ...req.body,
    });
    await Audit.auditLog(null, {
      user_email: req.user?.email || null,
      action: 'ai.calendar.update',
      entity: 'calendar',
      entity_id: event.id,
    });
    res.json(event);
    const startAt =
      typeof event.start === 'string'
        ? event.start
        : event.start?.dateTime || event.start?.date || null;
    const endAt =
      typeof event.end === 'string'
        ? event.end
        : event.end?.dateTime || event.end?.date || null;

    try {
      await query(
        `
    UPDATE public.calendar_events
       SET summary=$2, description=$3, start_at=$4, end_at=$5
     WHERE external_event_id=$1
  `,
        [
          event.id,
          event.summary || null,
          event.description || null,
          startAt,
          endAt,
        ],
      ).catch(() => {});
    } catch (e) {
      /* no-op */
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/calendar/events/:id', async (req, res, next) => {
  try {
    const ok = await Calendar.deleteEvent({
      orgId: req.user?.org_id,
      id: req.params.id,
      calendarId: req.query.calendarId,
    });
    try {
      await query(`DELETE FROM public.calendar_events WHERE external_event_id=$1`, [req.params.id]).catch(() => {});
    } catch (e) {
      /* no-op */
    }
    await Audit.auditLog(null, {
      user_email: req.user?.email || null,
      action: 'ai.calendar.delete',
      entity: 'calendar',
      entity_id: req.params.id,
    });
    res.json({ ok });
  } catch (err) {
    next(err);
  }
});

export default router;
