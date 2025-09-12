// backend/routes/admin/orgs.js
import { Router } from 'express';
import db from '#db';
import { startForOrg, stopForOrg } from '../../services/baileysService.js';

const r = Router();

// GET /api/admin/orgs?page=1&pageSize=20&q=term
r.get('/orgs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10)));
    const q = (req.query.q ?? '').trim() || null;

    const { rows: [{ count }] } = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM organizations o
        WHERE ($1::text IS NULL OR
               o.name ILIKE '%'||$1||'%' OR
               o.slug ILIKE '%'||$1||'%' OR
               o.document_value ILIKE '%'||$1||'%')`, [q]
    );

    const { rows: items } = await db.query(
      `WITH last_pay AS (
         SELECT DISTINCT ON (org_id)
           org_id, status, amount_cents, paid_at
         FROM payments
         ORDER BY org_id, paid_at DESC NULLS LAST
       )
       SELECT
         o.id, o.name, o.slug, o.photo_url, o.document_type, o.document_value,
         o.email, o.phone,
         p.id AS plan_id, p.name AS plan_name, p.price_cents,
         s.status AS subscription_status, o.trial_ends_at,
         lp.status AS last_payment_status,
         lp.amount_cents AS last_payment_amount_cents,
         lp.paid_at AS last_payment_paid_at,
         (SELECT COUNT(*) FROM payments  pp WHERE pp.org_id = o.id) AS payments_count,
         (SELECT COUNT(*) FROM purchases pu WHERE pu.org_id = o.id) AS purchases_count,
         o.whatsapp_baileys_enabled, o.whatsapp_baileys_status, o.whatsapp_baileys_phone
       FROM organizations o
       LEFT JOIN subscriptions s ON s.org_id=o.id AND s.status IN ('trialing','active','past_due')
       LEFT JOIN plans p ON p.id = COALESCE(o.plan_id, s.plan_id)
       LEFT JOIN last_pay lp ON lp.org_id=o.id
       WHERE ($1::text IS NULL OR
              o.name ILIKE '%'||$1||'%' OR
              o.slug ILIKE '%'||$1||'%' OR
              o.document_value ILIKE '%'||$1||'%')
       ORDER BY o.created_at DESC
       OFFSET $2 LIMIT $3`,
      [q, (page - 1) * pageSize, pageSize]
    );

    res.json({ page, pageSize, total: count, items });
  } catch (e) { next(e); }
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

export default r;
