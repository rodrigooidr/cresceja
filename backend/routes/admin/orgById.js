// backend/routes/admin/orgById.js
import { Router } from 'express';
import { db } from './orgs.shared.js';
import { withOrgId } from '../../middleware/withOrgId.js';
import { startForOrg, stopForOrg } from '../../services/baileysService.js';

const router = Router({ mergeParams: true });

router.use(withOrgId);

function resolveOrgId(req) {
  return req.orgId || req.params.orgId;
}

// PATCH /api/admin/orgs/:orgId
router.patch('/', async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
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
  } catch (e) {
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
