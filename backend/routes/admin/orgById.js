// backend/routes/admin/orgById.js
import { Router } from 'express';
import { z } from 'zod';
import { db } from './orgs.shared.js';
import authRequired from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/requireRole.js';
import { withOrgId } from '../../middleware/withOrgId.js';
import { startForOrg, stopForOrg } from '../../services/baileysService.js';

const ADMIN_ROLES = new Set(['SuperAdmin', 'Support']);

const BaseUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).nullable().optional(),
    status: z.enum(['active', 'inactive', 'suspended', 'canceled']).optional(),
    plan_id: z.string().uuid().nullable().optional(),
    trial_ends_at: z.string().min(1).nullable().optional(),
    document_type: z.enum(['CNPJ', 'CPF']).nullable().optional(),
    document_value: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    phone_e164: z.string().nullable().optional(),
    razao_social: z.string().nullable().optional(),
    nome_fantasia: z.string().nullable().optional(),
    site: z.string().url().nullable().optional(),
    ie: z.string().nullable().optional(),
    ie_isento: z.boolean().optional(),
    cep: z.string().nullable().optional(),
    logradouro: z.string().nullable().optional(),
    numero: z.string().nullable().optional(),
    complemento: z.string().nullable().optional(),
    bairro: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    uf: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    resp_nome: z.string().nullable().optional(),
    resp_cpf: z.string().nullable().optional(),
    resp_email: z.string().email().nullable().optional(),
    resp_phone_e164: z.string().nullable().optional(),
    photo_url: z.string().url().nullable().optional(),
    meta: z.any().optional(),
  })
  .partial();

const AdminOnlySchema = z
  .object({
    whatsapp_baileys_enabled: z.boolean().optional(),
    whatsapp_mode: z.enum(['baileys', 'none']).optional(),
    whatsapp_baileys_status: z.string().nullable().optional(),
    whatsapp_baileys_phone: z.string().nullable().optional(),
  })
  .partial();

const OrgUpdateSchema = BaseUpdateSchema.merge(AdminOnlySchema);

const router = Router({ mergeParams: true });

router.use(authRequired);
router.use(requireRole([ROLES.SuperAdmin, ROLES.Support]));
router.use(withOrgId);

function resolveOrgId(req) {
  return req.orgId || req.params.orgId;
}

// PATCH /api/admin/orgs/:orgId
router.patch('/', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const parsed = OrgUpdateSchema.parse(req.body || {});

    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : req.user?.role
      ? [req.user.role]
      : [];
    const canManageBaileys = userRoles.some((role) => ADMIN_ROLES.has(role));

    const baseUpdates = {};
    const adminUpdates = {};

    const assignString = (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    };

    if (parsed.name !== undefined) baseUpdates.name = String(parsed.name).trim();
    if (parsed.slug !== undefined) baseUpdates.slug = assignString(parsed.slug);
    if (parsed.status !== undefined) baseUpdates.status = parsed.status;
    if (parsed.plan_id !== undefined) baseUpdates.plan_id = assignString(parsed.plan_id);
    if (parsed.trial_ends_at !== undefined)
      baseUpdates.trial_ends_at = assignString(parsed.trial_ends_at);
    if (parsed.document_type !== undefined) baseUpdates.document_type = assignString(parsed.document_type);
    if (parsed.document_value !== undefined)
      baseUpdates.document_value = assignString(parsed.document_value);
    if (parsed.email !== undefined)
      baseUpdates.email = assignString(parsed.email)?.toLowerCase() ?? null;
    if (parsed.phone !== undefined) baseUpdates.phone = assignString(parsed.phone);
    if (parsed.phone_e164 !== undefined)
      baseUpdates.phone_e164 = assignString(parsed.phone_e164);
    if (parsed.razao_social !== undefined)
      baseUpdates.razao_social = assignString(parsed.razao_social);
    if (parsed.nome_fantasia !== undefined)
      baseUpdates.nome_fantasia = assignString(parsed.nome_fantasia);
    if (parsed.site !== undefined) baseUpdates.site = assignString(parsed.site);
    if (parsed.ie !== undefined) baseUpdates.ie = assignString(parsed.ie);
    if (parsed.ie_isento !== undefined) baseUpdates.ie_isento = !!parsed.ie_isento;
    if (parsed.cep !== undefined) baseUpdates.cep = assignString(parsed.cep);
    if (parsed.logradouro !== undefined) baseUpdates.logradouro = assignString(parsed.logradouro);
    if (parsed.numero !== undefined) baseUpdates.numero = assignString(parsed.numero);
    if (parsed.complemento !== undefined) baseUpdates.complemento = assignString(parsed.complemento);
    if (parsed.bairro !== undefined) baseUpdates.bairro = assignString(parsed.bairro);
    if (parsed.cidade !== undefined) baseUpdates.cidade = assignString(parsed.cidade);
    if (parsed.uf !== undefined) baseUpdates.uf = assignString(parsed.uf)?.toUpperCase() ?? null;
    if (parsed.country !== undefined) baseUpdates.country = assignString(parsed.country);
    if (parsed.resp_nome !== undefined) baseUpdates.resp_nome = assignString(parsed.resp_nome);
    if (parsed.resp_cpf !== undefined) baseUpdates.resp_cpf = assignString(parsed.resp_cpf);
    if (parsed.resp_email !== undefined)
      baseUpdates.resp_email = assignString(parsed.resp_email)?.toLowerCase() ?? null;
    if (parsed.resp_phone_e164 !== undefined)
      baseUpdates.resp_phone_e164 = assignString(parsed.resp_phone_e164);
    if (parsed.photo_url !== undefined) baseUpdates.photo_url = assignString(parsed.photo_url);
    if (parsed.meta !== undefined) {
      if (parsed.meta === null) baseUpdates.meta = null;
      else if (typeof parsed.meta === 'string') baseUpdates.meta = parsed.meta;
      else baseUpdates.meta = JSON.stringify(parsed.meta);
    }

    if (parsed.whatsapp_baileys_enabled !== undefined)
      adminUpdates.whatsapp_baileys_enabled = !!parsed.whatsapp_baileys_enabled;
    if (parsed.whatsapp_mode !== undefined)
      adminUpdates.whatsapp_mode = parsed.whatsapp_mode || 'none';
    if (parsed.whatsapp_baileys_status !== undefined)
      adminUpdates.whatsapp_baileys_status = assignString(parsed.whatsapp_baileys_status);
    if (parsed.whatsapp_baileys_phone !== undefined)
      adminUpdates.whatsapp_baileys_phone = assignString(parsed.whatsapp_baileys_phone);

    const updates = { ...Object.fromEntries(Object.entries(baseUpdates).filter(([, v]) => v !== undefined)) };

    if (canManageBaileys) {
      Object.assign(
        updates,
        Object.fromEntries(Object.entries(adminUpdates).filter(([, v]) => v !== undefined))
      );
    }

    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: 'no_fields_to_update' });

    const params = [];
    const sets = keys.map((key, index) => {
      let value = updates[key];
      if (key === 'plan_id' && !value) value = null;
      if (key === 'trial_ends_at' && !value) value = null;
      if (key === 'meta' && value !== null && typeof value !== 'string') value = JSON.stringify(value);
      params.push(value);
      return `${key}=$${index + 1}`;
    });

    params.push(orgId);
    await db.query(
      `UPDATE public.organizations SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length}`,
      params,
    );

    const {
      rows: [org],
    } = await db.query(
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
         o.phone_e164,
         o.cnpj,
         o.razao_social,
         o.nome_fantasia,
         o.site,
         o.ie,
         o.ie_isento,
         o.cep,
         o.logradouro,
         o.numero,
         o.complemento,
         o.bairro,
         o.cidade,
         o.uf,
         o.country,
         o.resp_nome,
         o.resp_cpf,
         o.resp_email,
         o.resp_phone_e164,
         o.whatsapp_baileys_enabled,
         o.whatsapp_mode,
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
  } catch (e) {
    if (e?.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: e.issues });
    }
    next(e);
  }
});

// PUT /api/admin/orgs/:orgId/plan
router.put('/plan', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
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
  } catch (e) {
    next(e);
  }
});

// PATCH /api/admin/orgs/:orgId/credits
router.patch('/credits', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
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
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId
router.get('/', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const {
      rows: [org],
    } = await db.query(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
    if (!org) return res.status(404).json({ error: 'not_found' });

    const { rows: payments } = await db.query(
      `SELECT id, status, amount_cents, currency, paid_at, created_at
         FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [orgId],
    );
    const { rows: purchases } = await db.query(
      `SELECT id, item, qty, amount_cents, created_at
         FROM purchases WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [orgId],
    );

    res.json({ org, payments, purchases });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/overview
router.get('/overview', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const org = await db.oneOrNone(
      'SELECT id, name, razao_social, cnpj, status, created_at FROM organizations WHERE id = $1',
      [orgId],
    );
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json({ overview: org });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/billing
router.get('/billing', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const payments = await db.any(
      'SELECT id, status, amount_cents, paid_at FROM payments WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20',
      [orgId],
    );
    res.json({ payments });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/users
router.get('/users', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const users = await db.any(
      `SELECT u.id, u.email, ou.role
         FROM org_users ou JOIN users u ON u.id = ou.user_id
        WHERE ou.org_id = $1
        ORDER BY u.email ASC
        LIMIT 50`,
      [orgId],
    );
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/logs
router.get('/logs', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const logs = await db.any(
      `SELECT id, path, method, created_at
         FROM support_audit_logs
        WHERE target_org_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [orgId],
    );
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

// ----- Settings -----
// GET /api/admin/orgs/:orgId/settings
router.get('/settings', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const {
      rows: [settings],
    } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    res.json(settings || { allow_baileys: false, whatsapp_active_mode: 'none' });
  } catch (e) {
    next(e);
  }
});

// PUT /api/admin/orgs/:orgId/settings { allow_baileys:boolean }
router.put('/settings', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { allow_baileys } = req.body ?? {};
    await db.query(
      `INSERT INTO org_settings (org_id, allow_baileys)
         VALUES ($1,$2)
         ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys`,
      [orgId, !!allow_baileys],
    );
    const {
      rows: [settings],
    } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

// ----- Baileys connection -----
// POST /api/admin/orgs/:orgId/baileys/connect { phone, allowed_test_emails }
router.post('/baileys/connect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { phone, allowed_test_emails } = req.body ?? {};
    if (!phone) return res.status(400).json({ error: 'phone_required' });

    const {
      rows: [settings],
    } = await db.query(
      `SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    if (!settings?.allow_baileys) {
      return res.status(403).json({ error: 'baileys_not_allowed' });
    }
    if (settings.whatsapp_active_mode === 'api') {
      return res.status(409).json({ error: 'ExclusiveMode', active: 'api', trying: 'baileys' });
    }
    if (!Array.isArray(allowed_test_emails) || !allowed_test_emails.includes('rodrigooidr@hotmail.com')) {
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
      await startForOrg(orgId, phone);
      await db.query(
        `INSERT INTO org_settings (org_id, whatsapp_active_mode)
           VALUES ($1,'baileys')
           ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='baileys'`,
        [orgId],
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    const {
      rows: [org],
    } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM organizations WHERE id=$1`,
      [orgId],
    );
    res.json({ ok: true, baileys: org, mode: 'baileys' });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/orgs/:orgId/baileys/disconnect
router.post('/baileys/disconnect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await stopForOrg(orgId);
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='baileys'`,
      [orgId],
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/baileys/status
router.get('/baileys/status', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const {
      rows: [org],
    } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone FROM organizations WHERE id=$1`,
      [orgId],
    );
    const {
      rows: [settings],
    } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    res.json({ ...org, mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) {
    next(e);
  }
});

// ----- API WhatsApp connection -----
// POST /api/admin/orgs/:orgId/api-whatsapp/connect
router.post('/api-whatsapp/connect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const {
      rows: [settings],
    } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    if (settings?.whatsapp_active_mode === 'baileys') {
      return res.status(409).json({ error: 'ExclusiveMode', active: 'baileys', trying: 'api' });
    }
    await db.query(
      `INSERT INTO org_settings (org_id, whatsapp_active_mode)
         VALUES ($1,'api')
         ON CONFLICT (org_id) DO UPDATE SET whatsapp_active_mode='api'`,
      [orgId],
    );
    res.json({ ok: true, mode: 'api' });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/orgs/:orgId/api-whatsapp/disconnect
router.post('/api-whatsapp/disconnect', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    await db.query(
      `UPDATE org_settings SET whatsapp_active_mode='none' WHERE org_id=$1 AND whatsapp_active_mode='api'`,
      [orgId],
    );
    res.json({ ok: true, mode: 'none' });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/api-whatsapp/status
router.get('/api-whatsapp/status', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const {
      rows: [settings],
    } = await db.query(
      `SELECT whatsapp_active_mode FROM org_settings WHERE org_id=$1`,
      [orgId],
    );
    res.json({ mode: settings?.whatsapp_active_mode || 'none' });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/orgs/:orgId/whatsapp/status
router.get('/whatsapp/status', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const [{ rows: [settings] }, { rows: [org] }, { rows: [apiCh] }] = await Promise.all([
      db.query(`SELECT allow_baileys, whatsapp_active_mode FROM org_settings WHERE org_id=$1`, [orgId]),
      db.query(`SELECT whatsapp_baileys_status, updated_at FROM organizations WHERE id=$1`, [orgId]),
      db.query(`SELECT status, updated_at FROM channels WHERE org_id=$1 AND type='whatsapp'`, [orgId]),
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
      },
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/admin/orgs/:orgId/whatsapp/allow_baileys
router.put('/whatsapp/allow_baileys', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    const { allow } = req.body ?? {};
    await db.query(
      `INSERT INTO org_settings (org_id, allow_baileys)
         VALUES ($1,$2)
         ON CONFLICT (org_id) DO UPDATE SET allow_baileys=EXCLUDED.allow_baileys`,
      [orgId, !!allow],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
