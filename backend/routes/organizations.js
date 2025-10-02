// backend/routes/orgs.js
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '#db';
import { z } from 'zod';
import authRequired from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole, requireOrgRole, ROLES } from '../middleware/requireRole.js';
import {
  listAdmin,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from '../controllers/organizationsController.js';

const organizationsRouter = Router();
const orgByIdRouter = Router({ mergeParams: true });

async function ensureOrgTables() {
  if (process.env.NODE_ENV === 'production') return;
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN
        CREATE TABLE public.organizations (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          plan text NOT NULL DEFAULT 'free',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='org_members') THEN
        CREATE TABLE public.org_members (
          org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
          user_id uuid NOT NULL,
          role text NOT NULL DEFAULT 'OrgOwner',
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (org_id, user_id)
        );
      END IF;
    END $$;
  `);
}

async function findOrgById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, plan, created_at FROM public.organizations WHERE id=$1`,
    [id],
  );
  return rows[0] || null;
}

async function upsertDefaultOrgForUser(user) {
  if (!user?.id) return null;
  await ensureOrgTables();

  let orgId = user.org_id || user.orgId || null;
  if (orgId) {
    const org = await findOrgById(orgId);
    if (org) {
      await pool.query(
        `INSERT INTO public.org_members (org_id, user_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (org_id, user_id) DO NOTHING`,
        [org.id, user.id, user.role || 'OrgOwner'],
      );
      return org;
    }
  }

  const existing = await pool.query(
    `SELECT o.id, o.name, o.plan, o.created_at
       FROM public.organizations o
       JOIN public.org_members m ON m.org_id = o.id
      WHERE m.user_id = $1
      ORDER BY o.created_at ASC
      LIMIT 1`,
    [user.id],
  );
  if (existing.rows[0]) return existing.rows[0];

  const newOrg = {
    id: orgId || randomUUID(),
    name: user.name ? `${user.name} Org` : 'Minha Organização',
    plan: 'free',
  };
  await pool.query(
    `INSERT INTO public.organizations (id, name, plan) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [newOrg.id, newOrg.name, newOrg.plan],
  );
  await pool.query(
    `INSERT INTO public.org_members (org_id, user_id, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (org_id, user_id) DO NOTHING`,
    [newOrg.id, user.id, 'OrgOwner'],
  );
  return newOrg;
}

// GET /api/orgs/current - org ativa do usuário autenticado
organizationsRouter.get('/current', authRequired, async (req, res, next) => {
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
organizationsRouter.get('/accessible', authRequired, async (req, res, next) => {
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

// GET /api/orgs/me - garante org padrão para o usuário
organizationsRouter.get('/me', authRequired, withOrg, async (req, res, next) => {
  try {
    const org = await upsertDefaultOrgForUser(req.user);
    if (!org) {
      return res.status(404).json({ error: 'org_not_found' });
    }
    req.orgId = org.id;
    return res.json({
      id: org.id,
      name: org.name,
      plan: org.plan || 'free',
      features: {
        ai: true,
        inbox: true,
        marketing: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

const SwitchSchema = z.object({ orgId: z.string().uuid() });

organizationsRouter.post('/switch', authRequired, async (req, res, next) => {
  try {
    const { orgId } = SwitchSchema.parse(req.body || {});
    const userId = req.user?.id || req.user?.sub || null;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const roleSet = new Set(
      [...(req.user?.roles || []), req.user?.role].filter(Boolean),
    );
    const isGlobalAdmin = roleSet.has('SuperAdmin') || roleSet.has('Support');

    const client = req.pool ?? pool;
    let allowed = false;

    if (isGlobalAdmin) {
      const { rows } = await client.query(
        `SELECT 1
           FROM public.organizations
          WHERE id = $1
          LIMIT 1`,
        [orgId],
      );
      allowed = rows?.length > 0;
    } else {
      const { rows } = await client.query(
        `SELECT 1
           FROM public.org_members
          WHERE user_id = $1 AND org_id = $2
          LIMIT 1`,
        [userId, orgId],
      );
      allowed = rows?.length > 0;
    }

    if (!allowed) {
      return res.status(isGlobalAdmin ? 404 : 403).json({ error: 'forbidden' });
    }

    return res.status(204).end();
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    return next(err);
  }
});

/**
 * GET /api/orgs?visibility=mine|all&q=&page=1&pageSize=50
 * - SuperAdmin/Support + visibility=all => lista TODAS de `orgs`
 * - Demais => lista orgs onde há vínculo em `org_users`
 * - Fallback: se vier vazio e o token tiver org_id, devolve 1 item sintético
 */
organizationsRouter.get('/', async (req, res) => {
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

orgByIdRouter.get(
  '/plan/summary',
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

const adminOrganizationsRouter = Router();

adminOrganizationsRouter.get(
  '/',
  authRequired,
  requireRole([ROLES.SuperAdmin, ROLES.Support]),
  listAdmin,
);

adminOrganizationsRouter.post(
  '/',
  authRequired,
  requireRole([ROLES.SuperAdmin, ROLES.Support]),
  createAdmin,
);

adminOrganizationsRouter.get(
  '/:orgId',
  authRequired,
  requireRole([ROLES.SuperAdmin, ROLES.Support]),
  getAdminById,
);

adminOrganizationsRouter.patch(
  '/:orgId',
  authRequired,
  requireRole([ROLES.SuperAdmin, ROLES.Support]),
  updateAdmin,
);

adminOrganizationsRouter.delete(
  '/:orgId',
  authRequired,
  requireRole([ROLES.SuperAdmin, ROLES.Support]),
  deleteAdmin,
);

export { adminOrganizationsRouter, orgByIdRouter };
export default organizationsRouter;
