// backend/routes/admin/orgs.js
import { Router } from 'express';
import { z } from 'zod';
import authRequired from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/requireRole.js';
import { db } from './orgs.shared.js';
import { OrgCreateSchema } from '../../validation/orgSchemas.cjs';

const router = Router();

router.use(authRequired);
router.use(requireRole([ROLES.SuperAdmin, ROLES.Support]));
const StatusSchema = z.enum(['active', 'inactive', 'all']).default('active');
const IdSchema = z.object({ orgId: z.string().uuid() });

// GET /api/admin/orgs?status=active|inactive|all&q=foo
router.get('/', async (req, res, next) => {
  try {
    req.log?.info(
      { route: 'admin.orgs.list', query: { status: req.query?.status, q: req.query?.q } },
      'admin orgs list request',
    );
    const rawStatus = String(req.query.status ?? 'active').toLowerCase();
    const status = StatusSchema.parse(rawStatus);
    const q = String(req.query.q ?? '').trim();

    const sql = `
      SELECT o.id,
             o.name,
             o.slug,
             o.status,
             o.trial_ends_at,
             o.plan_id,
             COALESCE(p.code, p.name) AS plan
        FROM public.organizations o
        LEFT JOIN public.plans p ON p.id = o.plan_id
       WHERE ($1 = 'all' OR o.status = $1)
         AND ($2 = '' OR unaccent(o.name) ILIKE '%' || unaccent($2) || '%')
       ORDER BY o.created_at DESC
       LIMIT 200
    `;

    const { rows } = await db.query(sql, [status, q]);
    res.json({
      items: (rows ?? []).map((row) => ({
        ...row,
        plan: row?.plan ?? null,
      })),
    });
  } catch (err) {
    req.log?.error(
      {
        route: 'admin.orgs.list',
        err: { message: err?.message, code: err?.code },
      },
      'admin orgs list failed',
    );
    next(err);
  }
});

// POST /api/admin/orgs
router.post('/', async (req, res, next) => {
  try {
    const payload = OrgCreateSchema.parse(req.body);

    const { rows: dupRows } = await db.query(
      `SELECT 1
         FROM public.organizations
        WHERE util_digits(cnpj) = util_digits($1)
           OR lower(email) = lower($2)
           OR phone_e164 = $3
        LIMIT 1`,
      [payload.cnpj, payload.email || null, payload.phone_e164 || null],
    );
    if (dupRows?.length) return res.status(409).json({ error: 'duplicate_org_key' });

    const { rows: inserted } = await db.query(
      `INSERT INTO public.organizations (
         id, cnpj, razao_social, nome_fantasia, ie, ie_isento,
         site, email, phone_e164, status,
         cep, logradouro, numero, complemento, bairro, cidade, uf, country,
         resp_nome, resp_cpf, resp_email, resp_phone_e164,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), util_digits($1), $2, $3, $4, $5,
         $6, lower($7), $8, $9,
         $10, $11, $12, $13, $14, $15, upper($16), $17,
         $18, util_digits($19), lower($20), $21,
         now(), now()
       ) RETURNING id`,
      [
        payload.cnpj,
        payload.razao_social,
        payload.nome_fantasia,
        payload.ie,
        payload.ie_isento,
        payload.site,
        payload.email,
        payload.phone_e164,
        payload.status,
        payload.endereco.cep,
        payload.endereco.logradouro,
        payload.endereco.numero,
        payload.endereco.complemento,
        payload.endereco.bairro,
        payload.endereco.cidade,
        payload.endereco.uf,
        payload.endereco.country,
        payload.responsavel.nome,
        payload.responsavel.cpf,
        payload.responsavel.email,
        payload.responsavel.phone_e164,
      ],
    );

    const org = inserted?.[0];
    if (!org) return res.status(500).json({ error: 'failed_to_create_org' });

    if (payload.plano?.plan_id) {
      await db.query(
        `INSERT INTO org_subscriptions (id, org_id, plan_id, period, trial_start, trial_end, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
        [
          org.id,
          payload.plano.plan_id,
          payload.plano.period || null,
          payload.plano.trial_start || null,
          payload.plano.trial_end || null,
        ],
      );
    }

    return res.status(201).json({ id: org.id });
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(422).json({ error: 'validation', issues: err.issues });
    next(err);
  }
});

router.delete(
  '/:orgId',
  async (req, res, next) => {
    try {
      const { orgId } = IdSchema.parse(req.params);
      const { rows } = await db.query(
        'SELECT slug FROM public.organizations WHERE id = $1',
        [orgId],
      );

      if (!rows?.length) {
        return res.status(404).json({ error: 'not_found' });
      }

      if (rows[0]?.slug === 'default') {
        return res.status(409).json({ error: 'protected_organization' });
      }

      await db.query('DELETE FROM public.organizations WHERE id = $1', [orgId]);

      return res.status(204).end();
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(422).json({ error: 'validation', issues: err.issues });
      }
      return next(err);
    }
  },
);

export default router;
