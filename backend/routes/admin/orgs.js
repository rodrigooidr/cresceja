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

// helpers
async function tableHas(table) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [table]
  );
  return !!rows?.length;
}
async function orgCols() {
  const { rows } = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations'`
  );
  return new Set(rows.map(r => r.column_name));
}
function normDigitsSql(expr) {
  // usa util_digits(x) se existir; senão, regexp_replace
  return `
    (CASE
       WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname='util_digits'
       ) THEN util_digits(${expr})
       ELSE regexp_replace(${expr}, '\\D', '', 'g')
     END)
  `;
}

// =============== LISTAGEM ==================
// GET /api/admin/orgs?status=active|inactive|all&q=foo
router.get('/', async (req, res, next) => {
  try {
    const StatusSchema = z.enum(['active', 'inactive', 'all']).default('active');
    const rawStatus = String(req.query.status ?? 'active').toLowerCase();
    const status = StatusSchema.parse(rawStatus);
    const q = String(req.query.q ?? '').trim();
    const qParam = q.length ? q : null;

    const sql = `
      SELECT o.id,
             o.name,
             o.slug,
             o.status,
             ${/* algumas bases têm trial_ends_at, outras não */''}
             (SELECT CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='organizations' AND column_name='trial_ends_at'
              )
              THEN o.trial_ends_at ELSE NULL END) AS trial_ends_at,
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
      ORDER BY o.created_at DESC NULLS LAST
      LIMIT 200
    `;
    const { rows } = await db.query(sql, [status, qParam]);

    res.json({
      items: (rows ?? []).map(row => ({ ...row, plan: row?.plan ?? null })),
    });
  } catch (err) {
    req.log?.error({ route: 'admin.orgs.list', err: { message: err?.message, code: err?.code } });
    next(err);
  }
});

// =============== CRIAÇÃO ==================
// POST /api/admin/orgs
router.post('/', async (req, res, next) => {
  try {
    const payload = OrgCreateSchema.parse(req.body ?? {});
    const cols = await orgCols();

    // checagem de duplicidade (cnpj/email/phone_e164) tolerante
    const cnpjExpr = normDigitsSql('$1'); // cnpj vindo do payload
    const cnpjCol = cols.has('cnpj') ? 'cnpj' : null;
    const emailCol = cols.has('email') ? 'email' : null;
    const phoneCol = cols.has('phone_e164') ? 'phone_e164' : (cols.has('phone') ? 'phone' : null);

    // monta WHERE dinâmico
    const whereParts = [];
    const args = [];
    if (cnpjCol && payload.cnpj) {
      whereParts.push(`${normDigitsSql(`o.${cnpjCol}`)} = ${cnpjExpr}`);
      args.push(payload.cnpj);
    }
    if (emailCol && payload.email) {
      whereParts.push(`lower(o.${emailCol}) = lower($${args.length + 1})`);
      args.push(payload.email);
    }
    if (phoneCol && payload.phone_e164) {
      whereParts.push(`o.${phoneCol} = $${args.length + 1}`);
      args.push(payload.phone_e164);
    }

    if (whereParts.length) {
      const dupSQL = `SELECT 1 FROM public.organizations o WHERE ${whereParts.join(' OR ')} LIMIT 1`;
      const { rows: dupRows } = await db.query(dupSQL, args);
      if (dupRows?.length) return res.status(409).json({ error: 'duplicate_org_key' });
    }

    // dados -> só insere colunas presentes
    const data = {
      // identidade básica
      cnpj: payload.cnpj,
      razao_social: payload.razao_social,
      nome_fantasia: payload.nome_fantasia,
      ie: payload.ie,
      ie_isento: payload.ie_isento,
      // contato
      site: payload.site,
      email: payload.email?.toLowerCase?.(),
      phone_e164: payload.phone_e164,
      status: payload.status ?? 'active',
      // endereço
      cep: payload.endereco?.cep,
      logradouro: payload.endereco?.logradouro,
      numero: payload.endereco?.numero,
      complemento: payload.endereco?.complemento,
      bairro: payload.endereco?.bairro,
      cidade: payload.endereco?.cidade,
      uf: payload.endereco?.uf?.toUpperCase?.(),
      country: payload.endereco?.country,
      // responsável
      resp_nome: payload.responsavel?.nome,
      resp_cpf: payload.responsavel?.cpf,
      resp_email: payload.responsavel?.email?.toLowerCase?.(),
      resp_phone_e164: payload.responsavel?.phone_e164,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const insertCols = [];
    const insertVals = [];
    const placeholders = [];

    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (!cols.has(k)) continue; // só usa colunas existentes
      insertCols.push(`"${k}"`);
      insertVals.push(v);
      placeholders.push(`$${insertVals.length}`);
    }

    // sempre insere id
    insertCols.unshift('id');
    placeholders.unshift(`gen_random_uuid()`);

    const { rows: inserted } = await db.query(
      `INSERT INTO public.organizations (${insertCols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      insertVals
    );
    const org = inserted?.[0];
    if (!org) return res.status(500).json({ error: 'failed_to_create_org' });

    // cria assinatura se a tabela existir e se veio payload.plano
    if (await tableHas('org_subscriptions') && payload.plano?.plan_id) {
      await db.query(
        `INSERT INTO public.org_subscriptions (id, org_id, plan_id, period, trial_start, trial_end, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
        [
          org.id,
          payload.plano.plan_id,
          payload.plano.period || null,
          payload.plano.trial_start || null,
          payload.plano.trial_end || null,
        ]
      );
    }

    return res.status(201).json({ id: org.id });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    next(err);
  }
});

// =============== DELETE ==================
const IdSchema = z.object({ orgId: z.string().uuid() });

router.delete('/:orgId', async (req, res, next) => {
  try {
    const { orgId } = IdSchema.parse(req.params);
    const { rows } = await db.query(`SELECT slug FROM public.organizations WHERE id=$1`, [orgId]);
    if (!rows?.length) return res.status(404).json({ error: 'not_found' });
    if (rows[0]?.slug === 'default') return res.status(409).json({ error: 'protected_organization' });

    await db.query(`DELETE FROM public.organizations WHERE id=$1`, [orgId]);
    return res.status(204).end();
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: err.issues });
    }
    next(err);
  }
});

export default router;
