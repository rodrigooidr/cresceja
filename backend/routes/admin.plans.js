// backend/routes/admin.plans.js
import express from "express";
import { query } from '#db';
import planCreditsRouter from './admin.plans.credits.js';

const router = express.Router();

// LISTA (admin) – traz tudo, com max_users do plans_meta
router.get("/", async (req, res, next) => {
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

// CRIAR
router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const vals = {
      id: String(b.id || "").trim(),
      name: String(b.name || "").trim(),
      monthlyPrice: Number(b.monthlyPrice || 0),
      currency: String(b.currency || "BRL"),
      modules: b.modules || {},
      is_published: !!b.is_published,
      sort_order: b.sort_order ?? 9999,
      is_free: !!b.is_free,
      trial_days: Number(b.trial_days ?? 14),
      billing_period_months: Number(b.billing_period_months ?? 1),
      max_users: Number(b.max_users ?? 1),
    };
    if (!vals.id) return res.status(400).json({ error: "missing_id" });

    await query(
      `
      INSERT INTO public.plans
        (id, name, monthly_price, currency, modules, is_published, sort_order, is_free, trial_days, billing_period_months)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
      `,
      [
        vals.id, vals.name, vals.monthlyPrice, vals.currency,
        JSON.stringify(vals.modules), vals.is_published, vals.sort_order,
        vals.is_free, vals.trial_days, vals.billing_period_months
      ]
    );

    await query(
      `
      INSERT INTO public.plans_meta (plan_id, max_users)
      VALUES ($1, $2)
      ON CONFLICT (plan_id) DO UPDATE SET max_users = EXCLUDED.max_users
      `,
      [vals.id, vals.max_users]
    );

    res.status(201).json({ id: vals.id });
  } catch (e) {
    next(e);
  }
});

// ATUALIZAR
router.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "missing_id" });

    const b = req.body || {};
    const vals = {
      name: String(b.name || "").trim(),
      monthlyPrice: Number(b.monthlyPrice || 0),
      currency: String(b.currency || "BRL"),
      modules: b.modules || {},
      is_published: !!b.is_published,
      sort_order: b.sort_order ?? 9999,
      is_free: !!b.is_free,
      trial_days: Number(b.trial_days ?? 14),
      billing_period_months: Number(b.billing_period_months ?? 1),
      max_users: Number(b.max_users ?? 1),
    };

    await query(
      `
      UPDATE public.plans
      SET name=$2,
          monthly_price=$3,
          currency=$4,
          modules=$5::jsonb,
          is_published=$6,
          sort_order=$7,
          is_free=$8,
          trial_days=$9,
          billing_period_months=$10
      WHERE id=$1
      `,
      [
        id, vals.name, vals.monthlyPrice, vals.currency,
        JSON.stringify(vals.modules), vals.is_published, vals.sort_order,
        vals.is_free, vals.trial_days, vals.billing_period_months
      ]
    );

    await query(
      `
      INSERT INTO public.plans_meta (plan_id, max_users)
      VALUES ($1, $2)
      ON CONFLICT (plan_id) DO UPDATE SET max_users = EXCLUDED.max_users
      `,
      [id, vals.max_users]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// PUBLICAR/DESPUBLICAR
router.post("/:id/publish", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const value = !!req.body?.is_published;
    await query(`UPDATE public.plans SET is_published=$2 WHERE id=$1`, [id, value]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// REMOVER
router.delete("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "missing_id" });
    await query('DELETE FROM public.plans WHERE id=$1', [id]);
    await query('DELETE FROM public.plans_meta WHERE plan_id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Créditos de IA (GET/PUT) por plano
router.use('/:id/credits', planCreditsRouter);

export default router;
