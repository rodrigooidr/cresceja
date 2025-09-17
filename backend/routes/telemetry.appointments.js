import { Router } from 'express';
import { appointmentsOverview } from '../services/telemetryService.js';
import * as authModule from '../middleware/auth.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.get('/telemetry/appointments/overview', requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = req.query.to || new Date().toISOString();
    const orgId = req.user?.org_id;
    const rows = await appointmentsOverview({ from, to, orgId });
    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
});

export default router;
