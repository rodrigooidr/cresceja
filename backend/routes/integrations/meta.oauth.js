import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { withOrg } from '../../middleware/withOrg.js';
import { pool } from '#db';

const router = Router();
router.use(authRequired, withOrg);

// Stub que guarda token de usuário da Meta (NÃO seguro para produção)
router.post('/connect', async (req, res, next) => {
  try {
    const { userAccessToken } = req.body || {};
    if (!userAccessToken) return res.status(400).json({ error: 'missing_user_access_token' });
    const db = req.db ?? pool;

    await db.query(
      `INSERT INTO meta_tokens (org_id, token, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (org_id) DO UPDATE SET token = EXCLUDED.token, created_at = now()`,
      [req.orgId, userAccessToken],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
