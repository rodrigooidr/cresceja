import { Router } from 'express';
import { authRequired, orgScope } from '../../middleware/auth.js';
import db from '../../db.js';

const router = Router();
router.use(authRequired, orgScope);

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

router.get('/oauth/start', async (req, res, next) => {
  try {
    const { limit, count } = await getLimits(req.orgId);
    if (limit >= 0 && count >= limit) {
      return res.status(403).json({
        error: 'plan_limit_reached',
        detail: 'Limite de calendários do Google atingido para seu plano.'
      });
    }
    res.json({ url: 'https://example.com/oauth' });
  } catch (e) { next(e); }
});

router.get('/status', async (req, res, next) => {
  try {
    const { limit, count } = await getLimits(req.orgId);
    res.json({ status: 'disconnected', limit, count });
  } catch (e) { next(e); }
});

router.get('/calendars', (_req, res) => {
  res.json({ items: [] });
});

router.post('/events', (_req, res) => {
  res.json({ ok: true });
});

router.post('/disconnect', (_req, res) => {
  res.json({ ok: true });
});

export default router;
