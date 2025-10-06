import express from 'express';
import { randomUUID } from 'crypto';
import db from '#db';
import { requireMinRole } from '../../auth/roles.js';

const router = express.Router();

// Todas as rotas exigem no mínimo OrgAdmin
router.use(requireMinRole('OrgAdmin'));

const cal = { logs: [], events: [] };
const log = (action, detail) => {
  cal.logs.unshift({ id: randomUUID(), ts: new Date().toISOString(), action, detail });
};

function resolveOrgId(req) {
  if (req.user?.role === 'SuperAdmin' && req.query?.orgId) return req.query.orgId;
  return req.user?.org_id;
}

async function getLimits(orgId) {
  const { rows: [{ value: limitValue }] = [{}] } = await db.query(
    `SELECT pf.value
       FROM plan_features pf
       JOIN organizations o ON o.plan_id = pf.plan_id
      WHERE o.id = $1 AND pf.feature_code = 'google_calendars'`,
    [orgId]
  );
  const limit = typeof limitValue === 'number' ? limitValue : Number(limitValue ?? 0);
  const { rows: [{ count }] = [{}] } = await db.query(
    `SELECT COUNT(*)::int AS count FROM google_calendar_accounts WHERE org_id=$1`,
    [orgId]
  );
  return { limit, count };
}

router.post('/integrations/google-calendar/connect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { limit, count } = await getLimits(orgId);
    if (limit >= 0 && count >= limit) {
      return res.status(403).json({ error: 'plan_limit_reached' });
    }
    res.json({ url: 'https://example.com/oauth' });
  } catch (e) { next(e); }
});

router.get('/integrations/google-calendar/status', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { limit, count } = await getLimits(orgId);
    res.json({ status: 'disconnected', limit, count });
  } catch (e) { next(e); }
});

router.get('/integrations/google-calendar/calendars', (_req, res) => {
  res.json({ items: [] });
});

router.post('/integrations/google-calendar/events', handleCreateEvent);
router.delete('/integrations/google-calendar/events/:id', handleDeleteEvent);
router.get('/integrations/google-calendar/logs', handleListLogs);
router.post('/integrations/google-calendar/propose-slots', handleProposeSlots);

router.get('/api/integrations/google/calendar/status', (_req, res) => {
  return res.status(200).json({ connected: false, account_email: null });
});

router.post('/api/integrations/google/calendar/propose-slots', handleProposeSlots);
router.post('/api/integrations/google/calendar/events', handleCreateEvent);
router.delete('/api/integrations/google/calendar/events/:id', handleDeleteEvent);
router.get('/api/integrations/google/calendar/logs', handleListLogs);

router.post('/integrations/google-calendar/test', (_req, res) => {
  res.json({ ok: true });
});

router.post('/integrations/google-calendar/disconnect', (_req, res) => {
  res.json({ ok: true });
});

function createLocalEvent({ org_id, title, start, end, attendees = [], conversation_id }) {
  const event = {
    id: randomUUID(),
    org_id,
    title,
    start,
    end,
    attendees,
    status: 'created_local',
    google_event_id: null,
    conversation_id: conversation_id || null,
    created_at: new Date().toISOString(),
  };
  cal.events.push(event);
  log('create_event', { event });
  return event;
}

function removeLocalEvent(id) {
  const index = cal.events.findIndex((event) => event.id === id);
  if (index < 0) return null;
  const [removed] = cal.events.splice(index, 1);
  log('delete_event', { id, removed });
  return removed;
}

function handleCreateEvent(req, res) {
  const event = createLocalEvent(req.body || {});
  return res.status(201).json({ event });
}

function handleDeleteEvent(req, res) {
  const removed = removeLocalEvent(req.params.id);
  if (!removed) return res.status(404).json({ error: 'not_found' });
  return res.status(204).send();
}

function handleListLogs(_req, res) {
  return res.status(200).json({ logs: cal.logs.slice(0, 200) });
}

function handleProposeSlots(req, res) {
  const { duration_min = 30, count = 3, tz = 'America/Sao_Paulo', start_from } = req.body || {};
  const start = start_from ? new Date(start_from) : new Date();
  const slots = [];
  let cursor = new Date(start);
  while (slots.length < count) {
    cursor.setMinutes(cursor.getMinutes() + ((30 - (cursor.getMinutes() % 30)) % 30));
    const hours = cursor.getHours();
    if (hours >= 9 && hours < 18) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration_min);
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), tz });
      cursor = new Date(slotEnd);
    } else {
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(9, 0, 0, 0);
      cursor = nextDay;
    }
  }
  log('propose_slots', { duration_min, count, tz, start_from, slots });
  return res.status(200).json({ slots });
}

export default router;
