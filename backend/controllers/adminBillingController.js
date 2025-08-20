import { query } from '../config/db.js';
import { auditLog } from '../services/audit.js';
import { getProvider } from '../services/billing/index.js';

export async function setPlan(req, res, next) {
  try {
    const { orgId } = req.params;
    const { plan_id, provider = 'stripe', due_date, amount_cents } = req.body || {};
    if (!plan_id) return res.status(400).json({ error: 'plan_id_required' });

    const { rows } = await query(
      `INSERT INTO subscriptions (org_id, plan_id, provider, status)
       VALUES ($1,$2,$3,'active')
       ON CONFLICT (org_id) DO UPDATE SET plan_id=EXCLUDED.plan_id, provider=EXCLUDED.provider, status='active', updated_at=NOW()
       RETURNING id`,
      [orgId, plan_id, provider]
    );
    const subId = rows[0].id;

    const prov = getProvider(provider);
    const external = await prov.createSubscription({ orgId, planId: plan_id });
    await query('UPDATE subscriptions SET provider_subscription_id=$1 WHERE id=$2', [external.id, subId]);

    if (due_date) {
      await query(
        `INSERT INTO invoices (org_id, subscription_id, amount_cents, due_date, status)
         VALUES ($1,$2,$3,$4::date,'pending')`,
        [orgId, subId, amount_cents || 0, due_date]
      );
    }

    await auditLog({ user_email: req.user.email, action: 'set_plan', entity: 'subscription', entity_id: subId, payload: { orgId, plan_id } });

    res.json({ id: subId });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req, res, next) {
  try {
    const { orgId } = req.params;
    const { rows: subRows } = await query(
      `SELECT id, plan_id, status, provider, current_period_end FROM subscriptions WHERE org_id=$1`,
      [orgId]
    );
    const { rows: invRows } = await query(
      `SELECT id, amount_cents, due_date, status, paid_at FROM invoices WHERE org_id=$1 ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({ subscription: subRows[0] || null, invoices: invRows });
  } catch (err) {
    next(err);
  }
}

export async function reactivate(req, res, next) {
  try {
    const { orgId } = req.params;
    const { invoice_id } = req.body || {};
    if (invoice_id) {
      await query(`UPDATE invoices SET status='paid', paid_at=NOW() WHERE id=$1 AND org_id=$2`, [invoice_id, orgId]);
    }
    await query(`UPDATE orgs SET status='active' WHERE id=$1`, [orgId]);
    await auditLog({ user_email: req.user.email, action: 'reactivate_org', entity: 'org', entity_id: orgId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
