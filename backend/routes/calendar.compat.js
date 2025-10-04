import { Router } from 'express';
import { authRequired, orgScope } from '../middleware/auth.js';
import googleCalendar from './integrations/google.calendar.js';

const r = Router();
r.use(authRequired, orgScope);

// Compat c/ frontend:
// GET /api/calendar/calendars -> /api/integrations/google-calendar/calendars
r.get('/calendars', (req, res, next) => {
  req.url = '/integrations/google-calendar/calendars';
  return googleCalendar(req, res, next);
});

// POST /api/calendar/events -> cria/lista
r.post('/events', (req, res, next) => {
  req.url = '/integrations/google-calendar/events';
  return googleCalendar(req, res, next);
});

// Itens de conveniência para UI atual (no momento vazios/estáticos)
r.get('/services', (_req, res) => res.json({ items: [] }));
r.get('/suggest', (_req, res) => res.json({ items: [] }));

export default r;
