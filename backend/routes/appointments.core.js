import express from 'express';
import { v4 as uuid } from 'uuid';
import { requireCalendarRole } from '../middleware/calendar.rbac.js';

const router = express.Router();

// GET /api/appointments/reports/overview
router.get('/api/appointments/reports/overview', requireCalendarRole(['admin', 'owner']), async (req, res) => {
  const { orgId, period } = req.query || {};
  return res.status(200).json({ kpis: {} });
});

// POST /api/appointments
router.post('/api/appointments', requireCalendarRole(['admin', 'owner', 'operator']), async (req, res) => {
  // TODO: inserir em appointments + CalendarService.createEvent
  // TODO: registrar audit_trace com { ts, actor, action, detail }
  // status: 'booked' após criar no Google; 'proposed' antes de confirmar
  const id = uuid();
  return res.status(201).json({ appointment: { id, status: 'booked' } });
});

// PUT /api/appointments/:id  (reagendar)
router.put('/api/appointments/:id', requireCalendarRole(['admin', 'owner', 'operator']), async (req, res) => {
  // TODO: atualizar no Google e no DB; status → 'rescheduled'
  // TODO: registrar audit_trace com ação de reagendamento
  return res.status(200).json({ appointment: { id: req.params.id, status: 'rescheduled' } });
});

// DELETE /api/appointments/:id (cancelar)
router.delete('/api/appointments/:id', requireCalendarRole(['admin', 'owner']), async (req, res) => {
  // TODO: cancelar no Google e no DB; status → 'cancelled'
  // TODO: registrar audit_trace com ação de cancelamento
  return res.status(204).send();
});

// POST /api/appointments/confirm/:id (resposta aos lembretes)
router.post('/api/appointments/confirm/:id', requireCalendarRole(['admin', 'owner', 'operator', 'marketing']), async (req, res) => {
  // TODO: marcar como 'confirmed'
  // TODO: considerar contacts.consent_whatsapp antes de enviar lembretes
  return res.status(200).json({ appointment: { id: req.params.id, status: 'confirmed' } });
});

// Webhook do Google (watch/syncToken)
router.post('/api/appointments/webhooks/google', async (req, res) => {
  // TODO: validar headers X-Goog-* e agendar resync com syncToken
  // TODO: registrar audit_trace para notificações recebidas
  return res.status(204).send();
});

export default router;
