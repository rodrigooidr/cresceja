import express from "express";
import { authRequired, requireRole } from "../middleware/auth.js";
import { query } from "../config/db.js";
import { normalizePlan } from "../utils/normalize.js";

const r = express.Router();

/** GET /api/admin/plans  – owner e client_admin */
r.get("/admin/plans", authRequired, requireRole("owner","client_admin"), async (_req, res, next)=>{
  try {
    const { rows } = await query(`
      SELECT
        id,
        name,
        monthly_price AS "monthlyPrice",
        currency,
        modules,
        is_published AS "is_published",
        sort_order AS "sort_order",
        is_free AS "is_free",
        trial_days AS "trial_days",
        billing_period_months AS "billing_period_months"
      FROM public.plans
      ORDER BY sort_order NULLS LAST, id
    `);
    res.json({ plans: rows });
  } catch (e) {
    next(e);
  }
});

/** POST /api/admin/plans  – create/upsert (owner, client_admin) */
r.post("/admin/plans", authRequired, requireRole("owner","client_admin"), async (req, res, next)=>{
  try {
    const p = normalizePlan(req.body || {});
    if (!p.id) return res.status(400).json({ error: "id_required" });

    await query(
      `INSERT INTO public.plans
         (id, name, monthly_price, currency, modules, is_published, sort_order, is_free, trial_days, billing_period_months)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name,
         monthly_price=EXCLUDED.monthly_price,
         currency=EXCLUDED.currency,
         modules=EXCLUDED.modules,
         is_published=EXCLUDED.is_published,
         sort_order=EXCLUDED.sort_order,
         is_free=EXCLUDED.is_free,
         trial_days=EXCLUDED.trial_days,
         billing_period_months=EXCLUDED.billing_period_months
      `,
      [p.id, p.name, p.monthlyPrice, p.currency, JSON.stringify(p.modules), p.is_published, p.sort_order, p.is_free, p.trial_days, p.billing_period_months]
    );
    res.json({ id: p.id, ok: true });
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/plans/:id – update (owner, client_admin) */
r.patch("/admin/plans/:id", authRequired, requireRole("owner","client_admin"), async (req, res, next)=>{
  try {
    const id = req.params.id;
    const diff = normalizePlan({ ...req.body, id });
    await query(
      `UPDATE public.plans SET
         name=$2,
         monthly_price=$3,
         currency=$4,
         modules=$5::jsonb,
         is_published=$6,
         sort_order=$7,
         is_free=$8,
         trial_days=$9,
         billing_period_months=$10
       WHERE id=$1`,
      [id, diff.name, diff.monthlyPrice, diff.currency, JSON.stringify(diff.modules), diff.is_published, diff.sort_order, diff.is_free, diff.trial_days, diff.billing_period_months]
    );
    res.json({ id, ok: true });
  } catch (e) {
    next(e);
  }
});

/** POST /api/admin/plans/:id/publish {is_published} */
r.post("/admin/plans/:id/publish", authRequired, requireRole("owner","client_admin"), async (req, res, next)=>{
  try {
    const id = req.params.id;
    const { is_published } = req.body || {};
    await query(`UPDATE public.plans SET is_published=$2 WHERE id=$1`, [id, !!is_published]);
    const { rows } = await query(`SELECT is_published FROM public.plans WHERE id=$1`, [id]);
    res.json({ id, is_published: rows[0]?.is_published, ok: true });
  } catch (e) {
    next(e);
  }
});

/** GET /api/subscription/status – qualquer usuário autenticado */
r.get("/subscription/status", authRequired, (req, res)=>{
  // demo simplificada
  res.json({ tenantId: req.user.tenantId, plan: "starter", status: "active" });
});

export default r;
