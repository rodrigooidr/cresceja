import { Router } from 'express';
import { appointmentsOverview } from '../services/telemetryService.js';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",;\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

router.get('/telemetry/appointments/export.csv', requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = req.query.to || new Date().toISOString();
    const orgId = req.user?.org_id;

    const rows = (await appointmentsOverview({ from, to, orgId })) || [];
    const header = ['day', 'pending', 'confirmed', 'canceled', 'noshow', 'reminded'];
    const csv = [header.join(';')]
      .concat(
        rows.map((row) =>
          [
            csvEscape(row.day),
            csvEscape(row.pending || 0),
            csvEscape(row.confirmed || 0),
            csvEscape(row.canceled || 0),
            csvEscape(row.noshow || 0),
            csvEscape(row.reminded || 0),
          ].join(';'),
        ),
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="appointments_${String(from).slice(0, 10)}_${String(to).slice(0, 10)}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
