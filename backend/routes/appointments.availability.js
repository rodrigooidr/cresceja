import express from 'express';
import { requireCalendarRole } from '../middleware/calendar.rbac.js';
import { freeBusy } from '../services/calendar/googleCalendar.service.js';

const router = express.Router();

// GET /api/appointments/availability?orgId&professionalId&appointmentTypeId&date=YYYY-MM-DD&period=morning|afternoon|evening
router.get('/api/appointments/availability', requireCalendarRole(['admin', 'owner', 'operator', 'marketing']), async (req, res) => {
  const { professionalId, appointmentTypeId, date, period } = req.query || {};
  // TODO: ler duration/buffers do appointment_types no DB
  const duration = 30, bufferBefore = 0, bufferAfter = 0;
  const startDay = new Date(`${date}T09:00:00-03:00`);
  const endDay   = new Date(`${date}T18:00:00-03:00`);
  const { busy } = await freeBusy({ professionalId, timeMin: startDay.toISOString(), timeMax: endDay.toISOString() });

  // gerar slots respeitando busy (simplificado)
  const slots = [];
  for (let t = new Date(startDay); t < endDay; t.setMinutes(t.getMinutes() + 30)) {
    const s = new Date(t);
    const e = new Date(t); e.setMinutes(e.getMinutes() + duration);
    const overlap = busy.some(b => !(e <= new Date(b.start) || s >= new Date(b.end)));
    if (!overlap) slots.push({ start: s.toISOString(), end: e.toISOString(), period });
    if (slots.length >= 5) break;
  }
  return res.status(200).json({ slots });
});

export default router;
