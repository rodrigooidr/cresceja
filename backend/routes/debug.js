import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { extractBearerToken } from '../middleware/_token.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();

router.get('/rls', async (req, res, next) => {
  try {
    const db = req.db;
    const { rows } = await db.query(`
      SELECT
        current_setting('app.org_id', true)  AS org_id,
        current_setting('app.user_id', true) AS user_id,
        current_setting('app.role',   true)  AS role
    `);
    res.json(rows[0] || {});
  } catch (e) {
    next(e);
  }
});

router.get('/whoami', authRequired, withOrg, (req, res) => {
  res.json({
    user: req.user,
    orgId: req.orgId || null,
    authHeader: req.headers?.authorization || null,
    queryToken: req.query?.access_token || null,
  });
});

router.get('/authdump', (req, res) => {
  res.json({
    authHeader: req.headers?.authorization || null,
    tokenExtracted: extractBearerToken(req),
    queryToken: req.query?.access_token || req.query?.token || null,
  });
});

export default router;
