import { Router } from 'express';
import { appointmentsFunnelByDay, appointmentsByPersonService } from '../services/telemetryService.js';
import * as authModule from '../middleware/auth.js';

const router = Router();

const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get('/telemetry/appointments/funnel/export.csv', requireAuth, async (req, res) => {
  const from = req.query.from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const to = req.query.to || new Date().toISOString();
  const orgId = req.user?.org_id;
  const rows = await appointmentsFunnelByDay({ from, to, orgId });
  const csv = ['day;requested;confirmed;canceled;noshow']
    .concat(
      (rows || []).map((r) =>
        [r.day, r.requested || 0, r.confirmed || 0, r.canceled || 0, r.noshow || 0]
          .map(csvEscape)
          .join(';')
      )
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="appointments_funnel_${String(from).slice(0, 10)}_${String(to).slice(0, 10)}.csv"`
  );
  res.send(csv);
});

router.get(
  '/telemetry/appointments/by-person-service/export.csv',
  requireAuth,
  async (req, res) => {
    const from = req.query.from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = req.query.to || new Date().toISOString();
    const orgId = req.user?.org_id;
    const rows = await appointmentsByPersonService({ from, to, orgId });
    const csv = ['person;service;confirmed;canceled;noshow']
      .concat(
        (rows || []).map((r) =>
          [r.person, r.service, r.confirmed || 0, r.canceled || 0, r.noshow || 0]
            .map(csvEscape)
            .join(';')
        )
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="appointments_person_service_${String(from).slice(0, 10)}_${String(to).slice(0, 10)}.csv"`
    );
    res.send(csv);
  }
);

export default router;
