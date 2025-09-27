// backend/routes/admin/orgs.js
import { Router } from 'express';
import db from '#db';
import { startForOrg, stopForOrg } from '../../services/baileysService.js';
import { OrgCreateSchema } from '../../validation/orgSchemas.cjs';
import * as requireRoleModule from '../../middleware/requireRole.js';

const requireRole =
  requireRoleModule.requireRole ??
  requireRoleModule.default?.requireRole ??
  requireRoleModule.default ??
  requireRoleModule;
const ROLES =
  requireRoleModule.ROLES ??
  requireRoleModule.default?.ROLES ??
  requireRoleModule.ROLES;

const r = Router();

function buildOrgFilters(query) {
  const params = [];
  const parts = [];
  const statusRaw = String(query.status ?? 'active').toLowerCase();
  const status = ['active', 'inactive', 'all'].includes(statusRaw) ? statusRaw : 'active';

  if (status === 'active' || status === 'inactive') {
    const idx = params.length + 1;
    params.push(status);
    parts.push(`o.status = $${idx}`);
  }

  const search = (query.q ?? query.search ?? '').trim();
  if (search) {
    const idx = params.length + 1;
    params.push(`%${search}%`);
    parts.push(`(o.name ILIKE $${idx} OR o.slug ILIKE $${idx} OR o.document_value ILIKE $${idx})`);
  }

  return {
    clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '',
    params,
    status,
  };
}

// GET /api/admin/orgs?status=active|inactive|all
r.get('/orgs', async (req, res, next) => {
  try {
    const filters = buildOrgFilters(req.query ?? {});
    const wantsPagination =
      Object.prototype.hasOwnProperty.call(req.query ?? {}, 'page') ||
      Object.prototype.hasOwnProperty.call(req.query ?? {}, 'pageSize') ||
      Object.prototype.hasOwnProperty.call(req.query ?? {}, 'limit');

    const rawPageSize = req.query?.pageSize ?? req.query?.limit;
    const pageSize = wantsPagination
      ? Math.max(1, Math.min(200, parseInt(rawPageSize ?? '50', 10) || 50))
      : null;
    const page = wantsPagination ? Math.max(1, parseInt(req.query?.page ?? '1', 10) || 1) : 1;

    let sql = `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.status,
        o.plan_id,
        p.name AS plan_name,
        p.price_cents,
        p.currency,
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
        o.created_at,
        o.updated_at
      FROM public.organizations o
      LEFT JOIN public.plans p ON p.id = o.plan_id
      ${filters.clause}
      ORDER BY o.name
    `;

    const dataParams = [...filters.params];
    if (wantsPagination) {
      const limitIdx = dataParams.length + 1;
      dataParams.push(pageSize);
      const offsetIdx = dataParams.length + 1;
      dataParams.push((page - 1) * pageSize);
      sql += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    }

    const { rows } = await db.query(sql, dataParams);

    let total = rows.length;
    if (wantsPagination) {
      const countSql = `SELECT COUNT(*)::int AS count FROM public.organizations o ${filters.clause}`;
      const { rows: countRows } = await db.query(countSql, filters.params);
      total = countRows[0]?.count ?? 0;
    }

    const payload = {
      data: rows,
      items: rows,
      count: total,
      total,
      status: filters.status,
    };
    if (wantsPagination) {
      payload.page = page;
      payload.pageSize = pageSize;
    }

    res.json(payload);
  } catch (e) { next(e); }
});

// PATCH /api/admin/orgs/:orgId
r.patch('/orgs/:orgId', async (req, res, next) => {
  try {
    const { orgId } = req.params;
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
r.put('/orgs/:orgId/plan', async (req, res, next) => {
  try {
    const { orgId } = req.params;
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
r.patch('/orgs/:orgId/credits', async (req, res, next) => {
  try {
    const { orgId } = req.params;
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
r.post('/orgs', async (req, res, next) => {
  try {
    const payload = OrgCreateSchema.parse(req.body);

    const dup = await db.oneOrNone(
      `SELECT 1
         FROM organizations
        WHERE util_digits(cnpj) = util_digits($1)
           OR lower(email) = lower($2)
           OR phone_e164 = $3
        LIMIT 1`,
      [payload.cnpj, payload.email || null, payload.phone_e164 || null]
    );
    if (dup) return res.status(409).json({ error: 'duplicate_org_key' });

    const org = await db.one(
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

    if (payload.plano?.plan_id) {
      await db.none(
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
r.get('/orgs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [org] } = await db.query(
      `SELECT * FROM organizations WHERE id = $1`, [id]
    );
    if (!org) return res.status(404).json({ error: 'not_found' });

    const { rows: payments }  = await db.query(
      `SELECT id, status, amount_cents, currency, paid_at, created_at
         FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]
    );
    const { rows: purchases } = await db.query(
      `SELECT id, item, qty, amount_cents, created_at
         FROM purchases WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]
    );

    res.json({ org, payments, purchases });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/overview
r.get('/orgs/:id/overview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const org = await db.oneOrNone(
      'SELECT id, name, razao_social, cnpj, status, created_at FROM organizations WHERE id = $1',
      [id]
    );
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json({ overview: org });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/billing
r.get('/orgs/:id/billing', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payments = await db.any(
      'SELECT id, status, amount_cents, paid_at FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );
    res.json({ payments });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/users
r.get('/orgs/:id/users', async (req, res, next) => {
  try {
    const { id } = req.params;
    const users = await db.any(
      `SELECT u.id, u.email, ou.role
         FROM org_users ou JOIN users u ON u.id = ou.user_id
        WHERE ou.org_id = $1
        ORDER BY u.email ASC
        LIMIT 50`,
      [id]
    );
    res.json({ users });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/logs
r.get('/orgs/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const logs = await db.any(
      `SELECT id, path, method, created_at
         FROM support_audit_logs
        WHERE target_org_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [id]
    );
    res.json({ logs });
  } catch (e) { next(e); }
});

// ----- Settings -----
// GET /api/admin/orgs/:id/settings
r.get('/orgs/:id/settings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
    );
    res.json(settings || { allow_baileys: false, whatsapp_active_mode: 'none' });
  } catch (e) { next(e); }
});

// PUT /api/admin/orgs/:id/settings { allow_baileys:boolean }
r.put('/orgs/:id/settings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { allow_baileys } = req.body ?? {};
    await db.query(
      `INSERT INTO org_settings (org_id, allow_baileys)
         VALUES ($1,$2)
         ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys`,
      [id, !!allow_baileys]
    );
    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
    );
    res.json(settings);
  } catch (e) { next(e); }
});

// ----- Baileys connection -----
// POST /api/admin/orgs/:id/baileys/connect { phone, allowed_test_emails }
r.post('/orgs/:id/baileys/connect', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone, allowed_test_emails } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: 'phone_required' });

    const { rows: [settings] } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
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
        [id]
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    const { rows: [org] } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM organizations WHERE id=$1`,
      [id]
    );
    res.json({ ok: true, baileys: org, mode: 'baileys' });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/orgs/:id/baileys/disconnect
r.post('/orgs/:id/baileys/disconnect', async (req, res, next) => {
  try {
    const { id } = req.params;
    await stopForOrg(id);
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='baileys'`,
      [id]
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/baileys/status
r.get('/orgs/:id/baileys/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [org] } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone FROM organizations WHERE id=$1`,
      [id]
    );
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
    );
    res.json({ ...org, mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) { next(e); }
});

// ----- API WhatsApp connection -----
// POST /api/admin/orgs/:id/api-whatsapp/connect
r.post('/orgs/:id/api-whatsapp/connect', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
    );
    if (settings?.whatsapp_active_mode === 'baileys') {
      return res.status(409).json({ error: 'ExclusiveMode', active: 'baileys', trying: 'api' });
    }
    await db.query(
      `INSERT INTO org_settings (org_id, whatsapp_active_mode)
         VALUES ($1,'api')
         ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='api'`,
      [id]
    );
    res.json({ ok: true, mode: 'api' });
  } catch (e) { next(e); }
});

// POST /api/admin/orgs/:id/api-whatsapp/disconnect
r.post('/orgs/:id/api-whatsapp/disconnect', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='api'`,
      [id]
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/api-whatsapp/status
r.get('/orgs/:id/api-whatsapp/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [settings] } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [id]
    );
    res.json({ mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) { next(e); }
});

// GET /api/admin/orgs/:id/whatsapp/status
r.get('/orgs/:id/whatsapp/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [{ rows: [settings] }, { rows: [org] }, { rows: [apiCh] }] = await Promise.all([
      db.query(`SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`, [id]),
      db.query(`SELECT whatsapp_baileys_status, updated_at FROM organizations WHERE id=$1`, [id]),
      db.query(`SELECT status, updated_at FROM channels WHERE org_id=$1 AND type='whatsapp'`, [id])
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
r.put('/orgs/:id/whatsapp/allow_baileys', async (req, res, next) => {
  try {
    const { id } = req.params;
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

export default r;
