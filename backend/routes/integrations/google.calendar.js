import { Router } from 'express';
import db from '../../db.js';
import { requireMinRole } from '../../auth/roles.js';

const r = Router();

// Todas as rotas exigem no mínimo OrgAdmin
r.use(requireMinRole('OrgAdmin'));

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

r.post('/integrations/google-calendar/connect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { limit, count } = await getLimits(orgId);
    if (limit >= 0 && count >= limit) {
      return res.status(403).json({ error: 'plan_limit_reached' });
    }
    res.json({ url: 'https://example.com/oauth' });
  } catch (e) { next(e); }
});

r.get('/integrations/google-calendar/status', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { limit, count } = await getLimits(orgId);
    res.json({ status: 'disconnected', limit, count });
  } catch (e) { next(e); }
});

r.get('/integrations/google-calendar/calendars', (_req, res) => {
  res.json({ items: [] });
});

r.post('/integrations/google-calendar/events', (_req, res) => {
  res.json({ ok: true });
});

r.post('/integrations/google-calendar/test', (_req, res) => {
  res.json({ ok: true });
});

r.post('/integrations/google-calendar/disconnect', (_req, res) => {
  res.json({ ok: true });
});

export default r;
