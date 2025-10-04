import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { pool } from '#db';

const router = Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const { rows } = await pool.query(
      `SELECT o.id, o.name, o.slug, o.status, o.plan_id
         FROM public.organizations o
         JOIN public.org_users ou ON ou.org_id = o.id
        WHERE ou.user_id = $1
        ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json({ items: rows });
  } catch (e) { next(e); }
});

router.get('/me', authRequired, withOrg, async (req, res, next) => {
  try {
    // 1) tenta org do payload/middleware
    let orgId = req.orgId;

    // 2) fallback: users.org_id
    if (!orgId && req.user?.org_id) {
      orgId = req.user.org_id;
    }

    // 3) fallback: primeira org via org_users
    if (!orgId && req.user?.id) {
      const r = await pool.query(
        `SELECT ou.org_id
           FROM public.org_users ou
          WHERE ou.user_id = $1
          ORDER BY ou.created_at NULLS LAST
          LIMIT 1`,
        [req.user.id]
      );
      orgId = r.rows[0]?.org_id || null;
    }

    if (!orgId) return res.status(403).json({ error: 'forbidden_org' });

    // carrega a org
    const orgQ = await pool.query(
      `SELECT o.id, o.name, o.slug, o.status, o.plan_id
         FROM public.organizations o
        WHERE o.id = $1
        LIMIT 1`,
      [orgId]
    );
    const org = orgQ.rows[0];
    if (!org) return res.status(404).json({ error: 'org_not_found' });

    // carrega features (se existir org_features)
    let features = { inbox: true, ai: true, marketing: true };
    try {
      const fQ = await pool.query(
        `SELECT features FROM public.org_features WHERE org_id = $1 LIMIT 1`,
        [orgId]
      );
      if (fQ.rows[0]?.features) features = fQ.rows[0].features;
    } catch {
      /* tabela pode não existir, ignora */
    }

    // resolve plano por plan_id (se houver)
    let plan = 'free';
    if (org.plan_id) {
      try {
        const pQ = await pool.query(`SELECT code FROM public.plans WHERE id = $1 LIMIT 1`, [org.plan_id]);
        plan = pQ.rows[0]?.code || plan;
      } catch {
        /* ignora */
      }
    }

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug || null,
      status: org.status || 'active',
      plan,
      features,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:orgId/features', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.json({ inbox: true, sse: true, templates: true, quickReplies: true });
  }
  // ...produção: validações reais
  return res.status(501).json({ error: 'not_implemented' });
});

export default router;
