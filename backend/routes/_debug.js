import express from 'express';
import db from '../db/index.js';
import { getUserRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/whoami', (req, res) => {
  res.json({
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      roles: getUserRoles(req),
    },
    org_id: req.org?.id || req.headers['x-org-id'] || null,
  });
});

router.get('/feature/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    const orgId =
      req?.org?.id ??
      req?.headers?.['x-org-id'] ??
      req?.user?.org_id ??
      req?.user?.orgId ??
      null;

    let row = null;
    if (orgId) {
      row = await db.oneOrNone(
        `select
           coalesce((features ->> $1)::boolean, false)       as f1,
           coalesce((features_jsonb ->> $1)::boolean, false) as f2
         from org_features
         where org_id = $2::uuid`,
        [key, orgId],
      );
    }

    res.json({
      orgId,
      key,
      dbValue: row
        ? { features: row.f1, features_jsonb: row.f2, enabled: !!(row.f1 || row.f2) }
        : null,
      whoami: { id: req.user?.id, roles: getUserRoles(req) },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
