// backend/routes/orgs.js
import { Router } from 'express';
import { pool } from '#db';
import authRequired from '../middleware/auth.js';
import * as requireRoleModule from '../middleware/requireRole.js';

const requireRole =
  requireRoleModule.requireRole ??
  requireRoleModule.default?.requireRole ??
  requireRoleModule.default ??
  requireRoleModule;
const requireOrgRole =
  requireRoleModule.requireOrgRole ??
  requireRoleModule.default?.requireOrgRole ??
  requireRoleModule.requireRole;
const ROLES =
  requireRoleModule.ROLES ??
  requireRoleModule.default?.ROLES ??
  requireRoleModule.ROLES;

const router = Router();

// GET /api/orgs/current - org ativa do usuário autenticado
router.get('/current', authRequired, async (req, res, next) => {
  try {
    const user = req.user || {};
    const orgId = user.org_id || null;
    if (!orgId) return res.status(404).json({ error: 'not_found' });

    const client = req.pool ?? pool;
    const { rows } = await client.query(
      `SELECT id, name, slug, status, plan_id, trial_ends_at
         FROM public.organizations
        WHERE id = $1
        LIMIT 1`,
      [orgId]
    );
    const org = rows[0];
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// GET /api/orgs/accessible - lista de orgs do usuário
router.get('/accessible', authRequired, async (req, res, next) => {
  try {
    const user = req.user || {};
    const userId = user.id || user.sub;
    if (!userId) return res.json({ data: [] });

    const client = req.pool ?? pool;
    const { rows } = await client.query(
      `SELECT o.id, o.name, o.slug, o.status, o.plan_id, o.trial_ends_at
         FROM public.organizations o
         JOIN public.org_members m ON m.org_id = o.id
        WHERE m.user_id = $1
        ORDER BY o.name ASC`,
      [userId]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orgs?visibility=mine|all&q=&page=1&pageSize=50
 * - SuperAdmin/Support + visibility=all => lista TODAS de `orgs`
 * - Demais => lista orgs onde há vínculo em `org_users`
 * - Fallback: se vier vazio e o token tiver org_id, devolve 1 item sintético
 */
router.get('/', async (req, res) => {
  const client = req.db || (await pool.connect());
  const mustRelease = !req.db;

  try {
    const user = req.user || {};
    const { visibility = 'mine', q = '', page = 1, pageSize = 50 } = req.query;

    const isSuper = ['SuperAdmin', 'Support'].includes(user.role);
    const wantAll = isSuper && String(visibility).toLowerCase() === 'all';

    const limit  = Math.max(1, Math.min(Number(pageSize) || 50, 200));
    const offset = Math.max(0, ((Number(page) || 1) - 1) * limit);

    const params = [];
    let i = 1;
    const where = [];

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where.push(`(o.name ILIKE $${i++})`);
    }

    let sqlList, sqlCount;

    if (wantAll) {
      // Lista direto da tabela orgs
      sqlList = `
        SELECT o.id, o.name, NULL::text AS slug, o.status, o.created_at
        FROM organizations o
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY o.name ASC
        LIMIT $${i} OFFSET $${i + 1}`;
      sqlCount = `
        SELECT COUNT(*)::int AS total
        FROM organizations o
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
      params.push(limit, offset);
    } else {
      // "Minhas" orgs via org_users
      params.push(user.id);
      const whereMine = [`m.user_id = $${i++}`, ...where];

      sqlList = `
        SELECT o.id, o.name, NULL::text AS slug, o.status, o.created_at
        FROM org_users m
        JOIN organizations o ON o.id = m.org_id
        ${whereMine.length ? `WHERE ${whereMine.join(' AND ')}` : ''}
        ORDER BY o.name ASC
        LIMIT $${i} OFFSET $${i + 1}`;
      sqlCount = `
        SELECT COUNT(*)::int AS total
        FROM org_users m
        JOIN organizations o ON o.id = m.org_id
        ${whereMine.length ? `WHERE ${whereMine.join(' AND ')}` : ''}`;
      params.push(limit, offset);
    }

    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlList, params),
      client.query(sqlCount, params.slice(0, params.length - 2)),
    ]);

    let items = rowsRes.rows || [];

    // Fallback para não travar a UI
    if (items.length === 0 && user.org_id) {
      items = [{
        id: user.org_id,
        name: 'Default Org',
        slug: null,
        status: 'active',
        created_at: null,
        synthetic: true,
      }];
    }

    return res.json({
      items,
      total: items.length,
      page: Number(page) || 1,
      pageSize: limit,
    });
  } catch (e) {
    req.log?.error({ err: e }, 'GET /orgs failed');
    return res.status(500).json({ error: 'orgs_list_failed', message: e.message });
  } finally {
    if (mustRelease) client.release();
  }
});

router.get(
  '/:orgId/plan/summary',
  authRequired,
  requireOrgRole([ROLES.OrgAdmin, ROLES.OrgOwner]),
  async (req, res, next) => {
    const existingClient = req.db || null;
    const client = existingClient || (await pool.connect());
    const mustRelease = !existingClient;

    try {
      const { orgId } = req.params;

      const { rows: orgRows } = await client.query(
        `SELECT id, plan_id, trial_ends_at
           FROM public.organizations
          WHERE id = $1`,
        [orgId],
      );

      if (!orgRows.length) {
        return res.status(404).json({ error: 'org_not_found' });
      }

      const org = orgRows[0];
      const { rows: creditsRows } = await client.query(
        `SELECT org_id, feature_code, remaining_total, expires_next
           FROM public.v_org_credits
          WHERE org_id = $1
          ORDER BY feature_code`,
        [orgId],
      );

      const summary = {
        org_id: org.id,
        plan_id: org.plan_id ?? null,
        trial_ends_at: org.trial_ends_at ?? null,
        credits: creditsRows.map((credit) => ({
          feature_code: credit.feature_code,
          remaining_total: credit.remaining_total ?? 0,
          expires_next: credit.expires_next ?? null,
        })),
      };

      res.json(summary);
    } catch (e) {
      next(e);
    } finally {
      if (mustRelease) client.release();
    }
  },
);

export default router;
