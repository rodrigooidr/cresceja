// backend/routes/orgs.public.js
import { Router } from 'express';
import authRequired from '../middleware/auth.js';
import { db } from './admin/orgs.shared.js'; // mesmo helper de conexão

const router = Router();
router.use(authRequired);

// GET /api/orgs?status=active|inactive|trial|suspended|canceled|all
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const roleSet = new Set(req.user?.roles || []);
    const isSuper = roleSet.has('SuperAdmin') || roleSet.has('Support');

    const status = String(req.query?.status || 'active').toLowerCase();
    const wantAll = status === 'all';

    let rows;
    if (isSuper) {
      rows = (
        await db.query(
          `
          SELECT id, name, slug, status, plan_id
            FROM public.organizations
           ${wantAll ? '' : `WHERE status = $1`}
           ORDER BY name ASC
          `,
          wantAll ? [] : [status]
        )
      ).rows;
    } else {
      rows = (
        await db.query(
          `
          SELECT o.id, o.name, o.slug, o.status, o.plan_id
            FROM public.organizations o
            JOIN public.v_user_memberships m
              ON m.org_id = o.id
           WHERE m.user_id = $1
             ${wantAll ? '' : `AND o.status = $2`}
           GROUP BY o.id
           ORDER BY o.name ASC
          `,
          wantAll ? [userId] : [userId, status]
        )
      ).rows;
    }

    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
});

export default router;
