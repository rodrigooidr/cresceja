// backend/routes/admin/orgs.js
import { Router } from 'express';
import { z } from 'zod';
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

const UpdateSchema = z
  .object({
    // básicos
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    // front manda “Ativa / Inativa” às vezes; normalizamos depois
    status: z.enum(['active', 'inactive']).optional(),
    email: z.string().email().optional(),
    phone_e164: z.string().optional(),

    // empresa
    cnpj: z.string().optional(),
    razao_social: z.string().optional(),
    nome_fantasia: z.string().optional(),
    site: z.string().url().optional(),
    ie: z.string().optional(),
    ie_isento: z.boolean().optional(),

    // endereço
    endereco: z
      .object({
        cep: z.string().optional(),
        logradouro: z.string().optional(),
        numero: z.string().optional(),
        complemento: z.string().optional(),
        bairro: z.string().optional(),
        cidade: z.string().optional(),
        uf: z.string().optional(),
        country: z.string().optional(),
      })
      .partial()
      .optional(),

    // responsável
    responsavel: z
      .object({
        nome: z.string().optional(),
        cpf: z.string().optional(),
        email: z.string().email().optional(),
        phone_e164: z.string().optional(),
      })
      .partial()
      .optional(),

    // flag do formulário: “Habilitar WhatsApp (Baileys)”
    whatsapp_baileys: z.boolean().optional(),
  })
  .passthrough();

// -------- CREATE (POST) ----------
const CreateSchema = z.object({
  // básicos
  name: z.string().min(2),
  slug: z.string().min(2).optional().nullable(),
  status: z.string().optional().nullable(), // pode vir "Ativa" do front

  email: z.string().email().optional().nullable(),
  phone_e164: z.string().optional().nullable(),

  // empresa
  cnpj: z.string().optional().nullable(),
  razao_social: z.string().optional().nullable(),
  nome_fantasia: z.string().optional().nullable(),
  site: z.string().url().optional().nullable(),
  ie: z.string().optional().nullable(),
  ie_isento: z.boolean().optional().nullable(),

  // endereço
  endereco: z.object({
    cep: z.string().optional().nullable(),
    logradouro: z.string().optional().nullable(),
    numero: z.string().optional().nullable(),
    complemento: z.string().optional().nullable(),
    bairro: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }).optional().nullable(),

  // responsável
  responsavel: z.object({
    nome: z.string().optional().nullable(),
    cpf: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone_e164: z.string().optional().nullable(),
  }).optional().nullable(),

  whatsapp_baileys: z.boolean().optional().nullable(),
}).passthrough();

// helper para normalizar vazio -> null
const toNull = (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v);

router.post('/', async (req, res, next) => {
  try {
    const body = CreateSchema.parse(req.body ?? {});

    const statusNorm = (body.status || '').toString().toLowerCase();
    const status =
      statusNorm === 'ativa' ? 'active' :
      statusNorm === 'inativa' ? 'inactive' :
      (['active','inactive'].includes(statusNorm) ? statusNorm : null);

    const e = body.endereco || {};
    const r = body.responsavel || {};

    const params = [
      toNull(body.name),                 // 1 obrigatório no schema (já garantido)
      toNull(body.slug),                 // 2
      toNull(status),                    // 3

      toNull(body.cnpj),                 // 4
      toNull(body.razao_social),         // 5
      toNull(body.nome_fantasia),        // 6
      toNull(body.site),                 // 7
      toNull(body.email),                // 8
      toNull(body.phone_e164),           // 9

      toNull(body.ie),                   // 10
      body.ie_isento ?? null,            // 11

      toNull(e.cep),                     // 12
      toNull(e.logradouro),              // 13
      toNull(e.numero),                  // 14
      toNull(e.complemento),             // 15
      toNull(e.bairro),                  // 16
      toNull(e.cidade),                  // 17
      toNull(e.uf),                      // 18
      toNull(e.country),                 // 19

      toNull(r.nome),                    // 20
      toNull(r.cpf),                     // 21
      toNull(r.email),                   // 22
      toNull(r.phone_e164),              // 23
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

    if (body.whatsapp_baileys === true) {
      await db.query(
        `INSERT INTO public.channels (id, org_id, type, mode, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'whatsapp', 'baileys', 'disconnected', now(), now())
         ON CONFLICT (org_id, type, mode) DO NOTHING;`,
        [org.id],
      );
    }

    return res.status(201).json({ ok: true, org });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    return next(err);
  }
});


router.post('/', async (req, res, next) => {
  try {
    const body = CreateSchema.parse(req.body ?? {});

    const e = body.endereco || {};
    const r = body.responsavel || {};

    // status vindo da UI (ex.: "Ativa") → 'active'
    const statusNorm = (body.status || '').toString().toLowerCase();
    const status =
      statusNorm === 'ativa' ? 'active' :
      statusNorm === 'inativa' ? 'inactive' :
      (['active','inactive'].includes(statusNorm) ? statusNorm : 'active');

    const params = [
      body.name,                    // 1
      body.slug ?? null,            // 2
      status,                       // 3
      body.cnpj ?? null,            // 4
      body.razao_social ?? null,    // 5
      body.nome_fantasia ?? null,   // 6
      body.site ?? null,            // 7
      body.email ?? null,           // 8
      body.phone_e164 ?? null,      // 9
      body.ie ?? null,              // 10
      body.ie_isento ?? null,       // 11
      e.cep ?? null,                // 12
      e.logradouro ?? null,         // 13
      e.numero ?? null,             // 14
      e.complemento ?? null,        // 15
      e.bairro ?? null,             // 16
      e.cidade ?? null,             // 17
      e.uf ?? null,                 // 18
      e.country ?? null,            // 19
      r.nome ?? null,               // 20
      r.cpf ?? null,                // 21
      r.email ?? null,              // 22
      r.phone_e164 ?? null,         // 23
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
        $1,
        COALESCE(util_slugify($2), util_slugify($1)),
        $3,
        util_digits($4), $5, $6, $7, lower($8), util_parse_e164($9, 'BR'),
        $10, $11,
        util_digits($12), $13, $14, $15, $16, $17, upper($18), upper($19),
        $20, util_digits($21), lower($22), util_parse_e164($23, 'BR'),
        now(), now()
      )
      RETURNING *;
    `;

    const { rows } = await db.query(sql, params);
    const created = rows[0];

    if (body.whatsapp_baileys === true) {
      await db.query(
        `INSERT INTO public.channels (id, org_id, type, mode, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'whatsapp', 'baileys', 'disconnected', now(), now())
         ON CONFLICT (org_id, type, mode) DO NOTHING;`,
        [created.id]
      );
    }

    return res.status(201).json({ ok: true, org: created });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    return next(err);
  }
});


router.put('/:orgId', async (req, res, next) => {
  try {
    const orgId = z.string().uuid().parse(req.params.orgId);
    const body = UpdateSchema.parse(req.body ?? {});

    // de/para campos aninhados
    const e = body.endereco || {};
    const r = body.responsavel || {};

    // status amigável vindo do front -> 'active'/'inactive'
    const statusNorm = (body.status || '').toString().toLowerCase();
    const status =
      statusNorm === 'ativa'
        ? 'active'
        : statusNorm === 'inativa'
        ? 'inactive'
        : ['active', 'inactive'].includes(statusNorm)
        ? statusNorm
        : undefined;

    const params = [
      body.name ?? null, // 1
      body.slug ?? null, // 2
      status ?? null, // 3
      body.cnpj ?? null, // 4
      body.razao_social ?? null, // 5
      body.nome_fantasia ?? null, // 6
      body.site ?? null, // 7
      body.email ?? null, // 8
      body.phone_e164 ?? null, // 9
      body.ie ?? null, // 10
      body.ie_isento ?? null, // 11
      e.cep ?? null, // 12
      e.logradouro ?? null, // 13
      e.numero ?? null, // 14
      e.complemento ?? null, // 15
      e.bairro ?? null, // 16
      e.cidade ?? null, // 17
      e.uf ?? null, // 18
      e.country ?? null, // 19
      r.nome ?? null, // 20
      r.cpf ?? null, // 21
      r.email ?? null, // 22
      r.phone_e164 ?? null, // 23
      orgId, // 24
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
    if (body.whatsapp_baileys === true) {
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
