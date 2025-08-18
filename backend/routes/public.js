// backend/routes/public.js
import express from "express";
import { query } from "../config/db.js";

const router = express.Router();

router.get("/plans", async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        p.id,
        p.name,
        p.monthly_price   AS "monthlyPrice",
        p.currency,
        p.modules,
        p.is_published    AS "is_published",
        p.sort_order      AS "sort_order",
        p.is_free         AS "is_free",
        p.trial_days      AS "trial_days",
        p.billing_period_months AS "billing_period_months",
        COALESCE(pm.max_users, 1) AS "max_users"
      FROM public.plans p
      LEFT JOIN public.plans_meta pm ON pm.plan_id = p.id
      ORDER BY p.sort_order NULLS LAST, p.id
    `);
    res.json({ plans: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
