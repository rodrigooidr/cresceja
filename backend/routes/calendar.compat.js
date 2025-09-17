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

    res.json(event);
  } catch (err) {
    next(err);
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
