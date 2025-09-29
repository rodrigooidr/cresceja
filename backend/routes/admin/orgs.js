// backend/routes/admin/orgs.js
import { Router } from 'express';
import { z } from 'zod';
import dbModule, { query } from '#db';
import { withOrgId } from '../../middleware/withOrgId.js';
import { OrgCreateSchema } from '../../validation/orgSchemas.cjs';
import { startForOrg, stopForOrg } from '../../services/baileysService.js';

const router = Router();
const StatusSchema = z.enum(['active', 'inactive', 'all']).default('active');

const baseQuery =
  typeof dbModule?.query === 'function'
    ? dbModule.query.bind(dbModule)
    : typeof query === 'function'
    ? query
    : null;

async function execQuery(sql, params) {
  if (!baseQuery) {
    const err = new Error('database_unavailable');
    err.status = 500;
    throw err;
  }
  return baseQuery(sql, params);
}

async function queryRows(sql, params) {
  const result = await execQuery(sql, params);
  return result?.rows ?? [];
}

async function queryOneOrNone(sql, params) {
  const rows = await queryRows(sql, params);
  return rows[0] ?? null;
}

async function queryOne(sql, params) {
  const row = await queryOneOrNone(sql, params);
  if (!row) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function queryNone(sql, params) {
  await execQuery(sql, params);
}

const db = {
  query: execQuery,
  any: queryRows,
  oneOrNone: queryOneOrNone,
  one: queryOne,
  none: queryNone,
};

// GET /api/admin/orgs?status=active|inactive|all
router.get('/', async (req, res, next) => {
  try {
    const rawStatus = (req.query.status ?? 'active').toString().toLowerCase();
    const status = StatusSchema.parse(rawStatus);
    const params = [];
    const where = [];

    if (status !== 'all') {
      params.push(status);
      where.push(`LOWER(o.status) = $${params.length}::text`);
    }

    const sql = `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.plan_id,
        o.trial_ends_at,
        o.status
      FROM public.organizations o
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY o.created_at DESC
      LIMIT 200
    `;

    const { rows } = await query(sql, params);
    res.json({ items: rows ?? [] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orgs/:orgId
router.patch('/:orgId', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const up = req.body || {};
    const allow = [
      'name',
      'slug',
      'status',
      'plan_id',
      'trial_ends_at',
      'document_type',
      'document_value',
      'email',
      'phone',
      'whatsapp_baileys_enabled',
      'whatsapp_baileys_status',
      'whatsapp_baileys_phone',
      'photo_url',
      'meta',
    ];

    const sets = [];
    const params = [];

    allow.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(up, key)) {
        let value = up[key];
        if (key === 'plan_id' && !value) value = null;
        if (key === 'trial_ends_at' && !value) value = null;
        if (key === 'meta' && value !== null && value !== undefined && typeof value !== 'string') {
          value = JSON.stringify(value);
        }
        if (['whatsapp_baileys_enabled'].includes(key)) {
          value = !!value;
        }
        params.push(value);
        sets.push(`${key}=$${params.length}`);
      }
    });

    if (!sets.length) return res.status(400).json({ error: 'no_fields_to_update' });

    params.push(orgId);
    await db.query(
      `UPDATE public.organizations SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length}`,
      params,
    );

    const { rows: [org] } = await db.query(
      `SELECT
         o.id,
         o.name,
         o.slug,
         o.status,
         (o.status = 'active') AS active,
         o.plan_id,
         p.name AS plan_name,
         o.trial_ends_at,
         o.document_type,
         o.document_value,
         o.email,
         o.phone,
         o.whatsapp_baileys_enabled,
         o.whatsapp_baileys_status,
         o.whatsapp_baileys_phone,
         o.photo_url,
         o.meta,
         o.updated_at
       FROM public.organizations o
       LEFT JOIN public.plans p ON p.id = o.plan_id
       WHERE o.id = $1`,
      [orgId],
    );

    return res.json({ ok: true, org: org || null });
  } catch (e) { next(e); }
});

// PUT /api/admin/orgs/:orgId/plan
router.put('/:orgId/plan', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { plan_id, status = 'active', start_at, end_at, trial_ends_at, meta } = req.body || {};
    if (!plan_id) return res.status(400).json({ error: 'plan_id_required' });

    await db.query(
      `UPDATE public.organizations
          SET plan_id=$1,
              trial_ends_at=COALESCE($2, trial_ends_at),
              updated_at=now()
        WHERE id=$3`,
      [plan_id, trial_ends_at || null, orgId],
    );

    await db.query(
      `INSERT INTO public.org_plan_history (org_id, plan_id, status, start_at, end_at, source, meta)
       VALUES ($1,$2,$3,COALESCE($4, now()), $5, 'manual', COALESCE($6,'{}'::jsonb))`,
      [
        orgId,
        plan_id,
        status,
        start_at || null,
        end_at || null,
        meta === undefined || meta === null ? null : JSON.stringify(meta),
      ],
    );

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/admin/orgs/:orgId/credits
router.patch('/:orgId/credits', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { feature_code, delta, expires_at, source, meta } = req.body || {};
    if (!feature_code || delta === undefined || delta === null) {
      return res.status(400).json({ error: 'feature_code_and_delta_required' });
    }

    const deltaNumber = Number(delta);
    if (!Number.isFinite(deltaNumber) || Number.isNaN(deltaNumber)) {
      return res.status(400).json({ error: 'delta_must_be_number' });
    }

    await db.query(
      `INSERT INTO public.org_credits (org_id, feature_code, delta, expires_at, source, meta)
       VALUES ($1,$2,$3,$4,COALESCE($5,'manual'),COALESCE($6,'{}'::jsonb))`,
      [
        orgId,
        feature_code,
        Math.trunc(deltaNumber),
        expires_at || null,
        source || null,
        meta === undefined || meta === null ? null : JSON.stringify(meta),
      ],
    );

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/admin/orgs
router.post('/', async (req, res, next) => {
  try {
    const payload = OrgCreateSchema.parse(req.body);

    const { rows: dupRows } = await query(
      `SELECT 1
         FROM organizations
        WHERE util_digits(cnpj) = util_digits($1)
           OR lower(email) = lower($2)
           OR phone_e164 = $3
        LIMIT 1`,
      [payload.cnpj, payload.email || null, payload.phone_e164 || null]
    );
    if (dupRows?.length) return res.status(409).json({ error: 'duplicate_org_key' });

    const { rows: inserted } = await query(
      `INSERT INTO organizations (
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
      ]
    );

    const org = inserted?.[0];
    if (!org) return res.status(500).json({ error: 'failed_to_create_org' });

    if (payload.plano?.plan_id) {
      await query(
        `INSERT INTO org_subscriptions (id, org_id, plan_id, period, trial_start, trial_end, created_at)
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
    if (err.name === 'ZodError')
      return res.status(422).json({ error: 'validation', issues: err.issues });
    next(err);
  }
});

// GET /api/admin/orgs/:id
router.get('/:orgId', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { rows: [org] } = await db.query(
      `SELECT * FROM organizations WHERE id = $1`, [orgId]
    );
    if (!org) return res.status(404).json({ error: 'not_found' });

    const { rows: payments }  = await db.query(
      `SELECT id, status, amount_cents, currency, paid_at, created_at
         FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`, [orgId]
    );
    const { rows: purchases } = await db.query(
      `SELECT id, item, qty, amount_cents, created_at
         FROM purchases WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`, [orgId]
    );

    res.json({ org, payments, purchases });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/overview
router.get('/:orgId/overview', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const org = await db.oneOrNone(
      'SELECT id, name, razao_social, cnpj, status, created_at FROM organizations WHERE id = $1',
      [orgId]
    );
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json({ overview: org });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/billing
router.get('/:orgId/billing', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const payments = await db.any(
      'SELECT id, status, amount_cents, paid_at FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20',
      [orgId]
    );
    res.json({ payments });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/users
router.get('/:orgId/users', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const users = await db.any(
      `SELECT u.id, u.email, ou.role
         FROM org_users ou JOIN users u ON u.id = ou.user_id
        WHERE ou.org_id = $1
        ORDER BY u.email ASC
        LIMIT 50`,
      [orgId]
    );
    res.json({ users });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/logs
router.get('/:orgId/logs', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const logs = await db.any(
      `SELECT id, path, method, created_at
         FROM support_audit_logs
        WHERE target_org_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [orgId]
    );
    res.json({ logs });
  } catch (e) { next(e); }
});

// ----- Settings -----
// GET /api/admin/orgs/:id/settings
router.get('/:orgId/settings', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json(settings || { allow_baileys: false, whatsapp_active_mode: 'none' });
  } catch (e) { next(e); }
});

// PUT /api/admin/orgs/:id/settings { allow_baileys:boolean }
router.put('/:orgId/settings', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { allow_baileys } = req.body ?? {};
    await db.query(
      `INSERT INTO org_settings (org_id, allow_baileys)
         VALUES ($1,$2)
         ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys`,
      [id, !!allow_baileys]
    );
    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json(settings);
  } catch (e) { next(e); }
});

// ----- Baileys connection -----
// POST /api/admin/orgs/:id/baileys/connect { phone, allowed_test_emails }
router.post('/:orgId/baileys/connect', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { phone, allowed_test_emails } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: 'phone_required' });

    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    if (!settings?.allow_baileys) {
      return res.status(403).json({ error: 'baileys_not_allowed' });
    }
    if (settings.whatsapp_active_mode === 'api') {
      return res
        .status(409)
        .json({ error: 'ExclusiveMode', active: 'api', trying: 'baileys' });
    }
    if (
      !Array.isArray(allowed_test_emails) ||
      !allowed_test_emails.includes('rodrigooidr@hotmail.com')
    ) {
      return res.status(400).json({
        error: 'ValidationError',
        details: [
          {
            field: 'allowed_test_emails',
            message: "Deve conter 'rodrigooidr@hotmail.com'.",
          },
        ],
      });
    }

    await db.query('BEGIN');
    try {
      await startForOrg(id, phone);
      await db.query(
        `INSERT INTO org_settings (org_id, whatsapp_active_mode)
           VALUES ($1,'baileys')
           ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='baileys'`,
        [orgId]
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    const { rows: [org] } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM organizations WHERE id=$1`,
      [orgId]
    );
    res.json({ ok: true, baileys: org, mode: 'baileys' });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/orgs/:id/baileys/disconnect
router.post('/:orgId/baileys/disconnect', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    await stopForOrg(id);
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='baileys'`,
      [orgId]
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/baileys/status
router.get('/:orgId/baileys/status', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { rows: [org] } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone FROM organizations WHERE id=$1`,
      [orgId]
    );
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json({ ...org, mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) { next(e); }
});

// ----- API WhatsApp connection -----
// POST /api/admin/orgs/:id/api-whatsapp/connect
router.post('/:orgId/api-whatsapp/connect', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    if (settings?.whatsapp_active_mode === 'baileys') {
      return res.status(409).json({ error: 'ExclusiveMode', active: 'baileys', trying: 'api' });
    }
    await db.query(
      `INSERT INTO org_settings (org_id, whatsapp_active_mode)
         VALUES ($1,'api')
         ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='api'`,
      [orgId]
    );
    res.json({ ok: true, mode: 'api' });
  } catch (e) { next(e); }
});

// POST /api/admin/orgs/:id/api-whatsapp/disconnect
router.post('/:orgId/api-whatsapp/disconnect', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='api'`,
      [orgId]
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/api-whatsapp/status
router.get('/:orgId/api-whatsapp/status', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId]
    );
    res.json({ mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/whatsapp/status
router.get('/:orgId/whatsapp/status', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const [{ rows: [settings] }, { rows: [org] }, { rows: [apiCh] }] = await Promise.all([
      db.query(`SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`, [orgId]),
      db.query(`SELECT whatsapp_baileys_status, updated_at FROM organizations WHERE id=$1`, [orgId]),
      db.query(`SELECT status, updated_at FROM channels WHERE org_id=$1 AND type='whatsapp'`, [orgId])
    ]);
    const now = new Date().toISOString();
    res.json({
      mode: settings?.whatsapp_active_mode || 'none',
      allow_baileys: settings?.allow_baileys ?? false,
      baileys: {
        connected: org?.whatsapp_baileys_status === 'connected',
        last_check: org?.updated_at || now,
      },
      api: {
        connected: apiCh?.status === 'connected',
        last_check: apiCh?.updated_at || now,
      }
    });
  } catch (e) { next(e); }
});

// PUT /api/admin/orgs/:id/whatsapp/allow_baileys
router.put('/:orgId/whatsapp/allow_baileys', withOrgId, async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { allow } = req.body ?? {};
    await db.query(
      `INSERT INTO org_settings (org_id, allow_baileys)
         VALUES ($1,$2)
         ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys`,
      [id, !!allow]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
