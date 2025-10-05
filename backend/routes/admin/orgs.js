// backend/routes/admin/orgs.js
import { Router } from 'express';
import { z } from 'zod';
import slugify from 'slugify';
import authRequired from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/requireRole.js';
import { db } from './orgs.shared.js';

const router = Router();

// Middlewares de auth/role (apenas SuperAdmin e Support podem usar rotas admin)
router.use(authRequired);
router.use(requireRole([ROLES.SuperAdmin, ROLES.Support]));

/* ============================================================================
 * GET /api/admin/orgs
 *   ?status=active|inactive|trial|suspended|canceled|all  (default: active)
 *   ?q=texto (filtra por name/slug)
 * ========================================================================== */
router.get('/', async (req, res, next) => {
  try {
    const QuerySchema = z.object({
      status: z
        .enum(['active', 'inactive', 'trial', 'suspended', 'canceled', 'all'])
        .default('active')
        .optional(),
      q: z.string().min(1).optional(),
    });

    const { status = 'active', q } = QuerySchema.parse(req.query);
    const params = [];
    const where = [];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(`(o.name ILIKE $${params.length} OR o.slug ILIKE $${params.length})`);
    }

    const sql = `
      SELECT o.id, o.name, o.slug, o.status, o.plan_id
        FROM public.organizations o
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.created_at DESC NULLS LAST, o.name ASC
       LIMIT 500
    `;

    const { rows } = await db.query(sql, params);
    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
});

/* ============================================================================
 * GET /api/admin/orgs/:orgId
 *  (seu GET por id “fica como já está”, mas deixo aqui completo)
 * ========================================================================== */
router.get('/:orgId', async (req, res, next) => {
  try {
    const orgId = z.string().uuid().parse(req.params.orgId);

    const { rows } = await db.query(
      `SELECT id, name, slug, status, plan_id,
              cnpj, razao_social, nome_fantasia, site, email, phone_e164,
              ie, ie_isento,
              cep, logradouro, numero, complemento, bairro, cidade, uf, country,
              resp_nome, resp_cpf, resp_email, resp_phone_e164,
              created_at, updated_at
         FROM public.organizations
        WHERE id = $1`,
      [orgId]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

/* ============================================================================
 * PUT /api/admin/orgs/:orgId
 * ========================================================================== */

const OrgCreateSchema = z
  .object({
    name: z.string().min(1, 'Required'),
    slug: z.string().min(1, 'Required'),
    status: z.enum(['active', 'inactive']).default('active'),

    cnpj: z.string().optional().nullable(),
    razao_social: z.string().optional().nullable(),
    nome_fantasia: z.string().optional().nullable(),
    site: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone_e164: z.string().optional().nullable(),
    ie: z.string().optional().nullable(),
    ie_isento: z.boolean().optional().nullable(),

    endereco: z
      .object({
        cep: z.string().optional().nullable(),
        logradouro: z.string().optional().nullable(),
        numero: z.string().optional().nullable(),
        complemento: z.string().optional().nullable(),
        bairro: z.string().optional().nullable(),
        cidade: z.string().optional().nullable(),
        uf: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    responsavel: z
      .object({
        nome: z.string().optional().nullable(),
        cpf: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone_e164: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    whatsapp_baileys_enabled: z.boolean().optional().nullable(),
    whatsapp_mode: z.enum(['baileys', 'cloud']).optional().nullable(),
    plan_id: z.string().uuid().optional().nullable(),
  })
  .strict();

const OrgUpdateSchema = z
  .object({
    name: z.string().min(1, 'Required').optional(),
    slug: z.string().min(1, 'Required').optional(),
    status: z.enum(['active', 'inactive']).optional(),

    cnpj: z.string().optional().nullable(),
    razao_social: z.string().optional().nullable(),
    nome_fantasia: z.string().optional().nullable(),
    site: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone_e164: z.string().optional().nullable(),
    ie: z.string().optional().nullable(),
    ie_isento: z.boolean().optional().nullable(),

    endereco: z
      .object({
        cep: z.string().optional().nullable(),
        logradouro: z.string().optional().nullable(),
        numero: z.string().optional().nullable(),
        complemento: z.string().optional().nullable(),
        bairro: z.string().optional().nullable(),
        cidade: z.string().optional().nullable(),
        uf: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    responsavel: z
      .object({
        nome: z.string().optional().nullable(),
        cpf: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone_e164: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    whatsapp_baileys_enabled: z.boolean().optional().nullable(),
    whatsapp_mode: z.enum(['baileys', 'cloud']).optional().nullable(),
    plan_id: z.string().uuid().optional().nullable(),
  })
  .strict();

const toNull = (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v);

function normalizeStatusValue(value, fallback = undefined) {
  if (value == null) return fallback;
  const norm = String(value).toLowerCase();
  if (norm === 'ativa') return 'active';
  if (norm === 'inativa') return 'inactive';
  if (norm === 'active' || norm === 'inactive') return norm;
  return fallback;
}

router.post('/', async (req, res, next) => {
  try {
    const raw = req.body || {};

    let name =
      raw.name ??
      raw.nome ??
      raw.company?.name ??
      raw.nome_fantasia ??
      raw.razao_social ??
      null;
    let slug = raw.slug ?? null;
    const status = normalizeStatusValue(raw.status, 'active');

    if (!slug && name) {
      slug = slugify(String(name), { lower: true, strict: true, locale: 'pt' }).slice(0, 64);
    }

    const parsed = OrgCreateSchema.safeParse({
      ...raw,
      name,
      slug,
      status,
    });

    if (!parsed.success) {
      return res.status(422).json({ error: 'validation', issues: parsed.error.issues });
    }

    const input = parsed.data;
    const endereco = input.endereco || {};
    const responsavel = input.responsavel || {};

    const params = [
      toNull(input.name),
      toNull(input.slug),
      toNull(input.status),

      toNull(input.cnpj),
      toNull(input.razao_social),
      toNull(input.nome_fantasia),
      toNull(input.site),
      toNull(input.email),
      toNull(input.phone_e164),

      toNull(input.ie),
      input.ie_isento ?? null,

      toNull(endereco.cep),
      toNull(endereco.logradouro),
      toNull(endereco.numero),
      toNull(endereco.complemento),
      toNull(endereco.bairro),
      toNull(endereco.cidade),
      toNull(endereco.uf),
      toNull(endereco.country),

      toNull(responsavel.nome),
      toNull(responsavel.cpf),
      toNull(responsavel.email),
      toNull(responsavel.phone_e164),
    ];

    const sql = `
      INSERT INTO public.organizations (
        id, name, slug, status,
        cnpj, razao_social, nome_fantasia, site, email, phone_e164,
        ie, ie_isento,
        cep, logradouro, numero, complemento, bairro, cidade, uf, country,
        resp_nome, resp_cpf, resp_email, resp_phone_e164,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        $1, util_slugify($2), COALESCE($3,'active'),
        util_digits($4), $5, $6, $7, lower($8), util_parse_e164($9, 'BR'),
        $10, $11,
        util_digits($12), $13, $14, $15, $16, $17, upper($18), upper($19),
        $20, util_digits($21), lower($22), util_parse_e164($23, 'BR'),
        now(), now()
      )
      RETURNING *;
    `;

    const { rows } = await db.query(sql, params);
    const org = rows[0];

    if (input.whatsapp_baileys_enabled === true || input.whatsapp_mode === 'baileys') {
      await db.query(
        `INSERT INTO public.channels (id, org_id, type, mode, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'whatsapp', 'baileys', 'disconnected', now(), now())
         ON CONFLICT (org_id, type, mode) DO NOTHING;`,
        [org.id]
      );
    }

    return res.status(201).json({ ok: true, org });
  } catch (err) {
    // Postgres unique violation
    if (err && err.code === '23505') {
      // err.constraint traz o nome do índice único violado
      if (err.constraint === 'ux_orgs_email_lower') {
        return res.status(409).json({
          error: 'conflict',
          field: 'email',
          message: 'Este e-mail já está em uso por outra organização.',
        });
      }
      if (err.constraint === 'ux_orgs_cnpj_digits') {
        return res.status(409).json({
          error: 'conflict',
          field: 'cnpj',
          message: 'Este CNPJ já está em uso por outra organização.',
        });
      }
      if (err.constraint === 'ux_orgs_slug') {
        return res.status(409).json({
          error: 'conflict',
          field: 'slug',
          message: 'Este slug já está em uso por outra organização.',
        });
      }
    }

    // Check constraint (usaremos no item 2)
    if (err && err.code === '23514' && err.constraint === 'chk_organizations_status') {
      return res.status(400).json({
        error: 'invalid_status',
        field: 'status',
        message: 'Status inválido para organização.',
      });
    }

    // fallback
    next(err);
  }
});


router.put('/:orgId', async (req, res, next) => {
  try {
    const orgId = z.string().uuid().parse(req.params.orgId);
    const raw = req.body || {};

    let name =
      raw.name ??
      raw.nome ??
      raw.company?.name ??
      raw.nome_fantasia ??
      raw.razao_social ??
      null;
    let slug = raw.slug ?? null;
    const status = normalizeStatusValue(raw.status, undefined);

    if (!slug && name) {
      slug = slugify(String(name), { lower: true, strict: true, locale: 'pt' }).slice(0, 64);
    }

    const parsed = OrgUpdateSchema.safeParse({
      ...raw,
      ...(name != null ? { name } : {}),
      ...(slug != null ? { slug } : {}),
      ...(status != null ? { status } : {}),
    });

    if (!parsed.success) {
      return res.status(422).json({ error: 'validation', issues: parsed.error.issues });
    }

    const input = parsed.data;
    const endereco = input.endereco || {};
    const responsavel = input.responsavel || {};

    const params = [
      toNull(input.name),
      toNull(input.slug),
      toNull(input.status),
      toNull(input.cnpj),
      toNull(input.razao_social),
      toNull(input.nome_fantasia),
      toNull(input.site),
      toNull(input.email),
      toNull(input.phone_e164),
      toNull(input.ie),
      input.ie_isento ?? null,
      toNull(endereco.cep),
      toNull(endereco.logradouro),
      toNull(endereco.numero),
      toNull(endereco.complemento),
      toNull(endereco.bairro),
      toNull(endereco.cidade),
      toNull(endereco.uf),
      toNull(endereco.country),
      toNull(responsavel.nome),
      toNull(responsavel.cpf),
      toNull(responsavel.email),
      toNull(responsavel.phone_e164),
      orgId,
    ];

    const sql = `
      UPDATE public.organizations SET
        name              = COALESCE($1,  name),
        slug              = COALESCE(util_slugify($2), slug),
        status            = COALESCE($3,  status),

        cnpj              = COALESCE(util_digits($4), cnpj),
        razao_social      = COALESCE($5,  razao_social),
        nome_fantasia     = COALESCE($6,  nome_fantasia),
        site              = COALESCE($7,  site),
        email             = COALESCE(lower($8), email),
        phone_e164        = COALESCE(util_parse_e164($9, 'BR'), phone_e164),

        ie                = COALESCE($10, ie),
        ie_isento         = COALESCE($11, ie_isento),

        cep               = COALESCE(util_digits($12), cep),
        logradouro        = COALESCE($13, logradouro),
        numero            = COALESCE($14, numero),
        complemento       = COALESCE($15, complemento),
        bairro            = COALESCE($16, bairro),
        cidade            = COALESCE($17, cidade),
        uf                = COALESCE(upper($18), uf),
        country           = COALESCE(upper($19), country),

        resp_nome         = COALESCE($20, resp_nome),
        resp_cpf          = COALESCE(util_digits($21), resp_cpf),
        resp_email        = COALESCE(lower($22), resp_email),
        resp_phone_e164   = COALESCE(util_parse_e164($23, 'BR'), resp_phone_e164),

        updated_at        = now()
      WHERE id = $24
      RETURNING *;
    `;

    const { rows } = await db.query(sql, params);
    if (!rows?.length) return res.status(404).json({ error: 'not_found' });
    const updated = rows[0];

    // (opcional) habilitar WhatsApp Baileys
    if (input.whatsapp_baileys_enabled === true || input.whatsapp_mode === 'baileys') {
      await db.query(
        `INSERT INTO public.channels (id, org_id, type, mode, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'whatsapp', 'baileys', 'disconnected', now(), now())
         ON CONFLICT (org_id, type, mode) DO NOTHING;`,
        [orgId]
      );
    }

    return res.json({ ok: true, org: updated });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    return next(err);
  }
});

export default router;
