import { Router } from 'express';
import { authRequired, orgScope } from '../middleware/auth.js';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});

const r = Router();
r.use(authRequired, orgScope);

// Status real via função SQL: get_ai_credits_status(uuid) -> jsonb
r.get('/status', async (req, res) => {
  try {
    const orgId = req.orgId;
    if (!orgId) return res.status(400).json({ error: 'missing_org', message: 'orgId not resolved' });

    const { rows } = await pool.query(
      'SELECT public.get_ai_credits_status($1) AS payload',
      [orgId]
    );
    const payload = rows?.[0]?.payload ?? null;
    return res.json(payload ?? { ok: true, categories: {}, orgId });
  } catch (err) {
    req.log?.error?.({ err }, 'ai-credits-status failed');
    return res.status(500).json({ error: 'ai_credits_status_failed' });
  }
});

export default r;
