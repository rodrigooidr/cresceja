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

/* ------------------------- helpers “tolerantes ao esquema” ------------------------- */

async function tableExists(table) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
      LIMIT 1`,
    [table]
  );
  return rows?.length > 0;
}

async function orgColumns() {
  const { rows } = await db.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='organizations'`
  );
  return new Set(rows.map(r => r.column_name));
}

function normStr(v) {
  return v === undefined || v === null ? null : String(v).trim();
}

function toBool(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true','1','yes','sim','y','on'].includes(s)) return true;
  if (['false','0','no','nao','não','n','off'].includes(s)) return false;
  return null;
}

function onlyExisting(colsSet, obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (colsSet.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

function buildInsertSQL(table, data) {
  const cols = Object.keys(data);
  const params = cols.map((_, i) => `$${i + 1}`);
  return {
    sql: `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(',')})
          VALUES (${params.join(',')})
          RETURNING id`,
    args: cols.map(c => data[c]),
  };
}

/* ------------------------------------- LIST ------------------------------------- */
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
    const qParam = q.length ? q : null;

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
      WHERE ($1::text = 'all' OR o.status = $1)
        AND (
          $2::text IS NULL
          OR lower(translate(o.name,
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )) LIKE lower(translate('%' || $2 || '%',
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          ))
        )
      ORDER BY o.created_at DESC
      LIMIT 200
    `;

    const { rows } = await db.query(sql, [status, qParam]);
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

/* ------------------------------------ CREATE ------------------------------------ */
// POST /api/admin/orgs
router.post('/', async (req, res, next) => {
  try {
    // valida payload conforme seu schema atual
    const payload = OrgCreateSchema.parse(req.body);

    // lê colunas existentes da tabela organizations
    const cols = await orgColumns();

    // checagem de duplicidade CONDICIONAL, só se as colunas existirem
    const dupConds = [];
    const dupArgs = [];
    if (cols.has('cnpj') && payload.cnpj) {
      dupArgs.push(payload.cnpj);
      dupConds.push(`util_digits(cnpj) = util_digits($${dupArgs.length})`);
    }
    if (cols.has('email') && payload.email) {
      dupArgs.push(payload.email);
      dupConds.push(`lower(email) = lower($${dupArgs.length})`);
    }
    if (cols.has('phone_e164') && payload.phone_e164) {
      dupArgs.push(payload.phone_e164);
      dupConds.push(`phone_e164 = $${dupArgs.length}`);
    }
    if (dupConds.length > 0) {
      const { rows: dupRows } = await db.query(
        `SELECT 1 FROM public.organizations WHERE ${dupConds.join(' OR ')} LIMIT 1`,
        dupArgs
      );
      if (dupRows?.length) return res.status(409).json({ error: 'duplicate_org_key' });
    }

    // mapeia os campos do payload -> colunas (só incluiremos se existirem)
    const baseData = {
      // básicos
      name: normStr(payload.name ?? payload.nome_fantasia ?? payload.razao_social),
      slug: normStr(payload.slug),
      status: normStr(payload.status) || 'active',

      // empresa
      cnpj: normStr(payload.cnpj),
      razao_social: normStr(payload.razao_social),
      nome_fantasia: normStr(payload.nome_fantasia),
      ie: normStr(payload.ie),
      ie_isento: toBool(payload.ie_isento),

      // contato
      site: normStr(payload.site),
      email: normStr(payload.email),
      phone: normStr(payload.phone),           // se existir coluna phone
      phone_e164: normStr(payload.phone_e164), // se existir coluna phone_e164

      // endereço
      cep: normStr(payload.endereco?.cep),
      logradouro: normStr(payload.endereco?.logradouro),
      numero: normStr(payload.endereco?.numero),
      complemento: normStr(payload.endereco?.complemento),
      bairro: normStr(payload.endereco?.bairro),
      cidade: normStr(payload.endereco?.cidade),
      uf: normStr(payload.endereco?.uf && payload.endereco.uf.toUpperCase()),
      country: normStr(payload.endereco?.country),

      // responsável
      resp_nome: normStr(payload.responsavel?.nome),
      resp_cpf: normStr(payload.responsavel?.cpf),
      resp_email: normStr(payload.responsavel?.email),
      resp_phone_e164: normStr(payload.responsavel?.phone_e164),

      // timestamps (se existirem)
      created_at: new Date(),
      updated_at: new Date(),
    };

    // só mantém colunas que existem de fato
    const data = onlyExisting(cols, baseData);

    // campo obrigatório mínimo
    if (!data.name) return res.status(422).json({ error: 'validation', issues: [{ path: ['name'], message: 'name_required' }] });

    // se a tabela tiver coluna 'uf', garanta uppercase
    if (data.uf) data.uf = data.uf.toUpperCase();

    // monta e executa o INSERT
    const { sql, args } = buildInsertSQL('public.organizations', data);
    const ins = await db.query(sql, args);
    const orgId = ins?.rows?.[0]?.id;
    if (!orgId) return res.status(500).json({ error: 'failed_to_create_org' });

    // assinatura: só se a tabela existir e o payload trouxer plan_id
    if (await tableExists('org_subscriptions')) {
      const p = payload?.plano ?? {};
      if (p.plan_id) {
        await db.query(
          `INSERT INTO org_subscriptions (id, org_id, plan_id, period, trial_start, trial_end, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
          [orgId, p.plan_id, p.period || null, p.trial_start || null, p.trial_end || null]
        );
      }
    }

    return res.status(201).json({ id: orgId });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    // em dev, mande a mensagem pra facilitar
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }
    next(err);
  }
});

/* ------------------------------------ DELETE ------------------------------------ */
router.delete('/:orgId', async (req, res, next) => {
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
});

export default router;
