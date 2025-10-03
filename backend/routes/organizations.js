import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { pool } from '#db';

const router = Router();
const isProd = String(process.env.NODE_ENV) === 'production';

async function ensureTables() {
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN
        CREATE TABLE public.organizations (
          id uuid PRIMARY KEY, name text NOT NULL, plan text NOT NULL DEFAULT 'free',
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

router.get('/me', authRequired, withOrg, async (req, res, next) => {
  try {
    if (!isProd) await ensureTables();

    // Tenta org do payload
    let orgId = req.orgId;
    if (!orgId && !isProd && req.user?.id) {
      // Recupera ou cria org padrão pro usuário em DEV
      const r = await pool.query(
        `SELECT o.id, o.name, o.plan FROM public.organizations o
         JOIN public.org_members m ON m.org_id=o.id
         WHERE m.user_id=$1 LIMIT 1`,
        [req.user.id]
      );
      if (r.rows[0]) orgId = r.rows[0].id;
      if (!orgId) {
        orgId = randomUUID();
        await pool.query(
          `INSERT INTO public.organizations (id, name, plan) VALUES ($1,$2,$3)
           ON CONFLICT (id) DO NOTHING`,
          [orgId, req.user.name ? `${req.user.name} Org` : 'Minha Organização', 'free']
        );
        await pool.query(
          `INSERT INTO public.org_members (org_id, user_id, role)
           VALUES ($1,$2,$3) ON CONFLICT (org_id, user_id) DO NOTHING`,
          [orgId, req.user.id, 'OrgOwner']
        );
      }
    }

    if (!orgId) return res.status(403).json({ error: 'forbidden_org' });

    req.orgId = orgId;
    return res.json({
      id: orgId,
      name: 'Minha Organização',
      plan: 'free',
      features: { inbox: true, ai: true, marketing: true },
    });
  } catch (e) { next(e); }
});

router.get('/orgs/:orgId/features', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.json({ inbox: true, sse: true, templates: true, quickReplies: true });
  }
  // ...produção: validações reais
  return res.status(501).json({ error: 'not_implemented' });
});

export default router;
