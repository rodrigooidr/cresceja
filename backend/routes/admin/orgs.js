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

// PUT /api/admin/orgs/:id/baileys {enabled:boolean, phone?:string}
r.put('/orgs/:id/baileys', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled, phone } = req.body ?? {};
    if (enabled === true && !phone) {
      return res.status(400).json({ error: 'phone_required' });
    }
    if (enabled) await startForOrg(id, phone);
    else        await stopForOrg(id);
    const { rows: [org] } = await db.query(
      `SELECT whatsapp_baileys_enabled, whatsapp_baileys_status, whatsapp_baileys_phone
         FROM organizations WHERE id=$1`, [id]
    );
    res.json({ ok: true, baileys: org });
  } catch (e) { next(e); }
});

export default r;
