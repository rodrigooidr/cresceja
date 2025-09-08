// backend/routes/subscription.js
import express from "express";
import jwt from "jsonwebtoken";
import { getClientByUserId, computeDaysRemaining, isExpired } from "../lib/subscription.js";
// Importa de forma genérica: aceita named export `auth` OU default export
import * as Auth from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "segredo";

// Fallback simples de autenticação via Bearer caso o middleware não exponha `auth`
function fallbackAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const token = auth.slice(7).trim();
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

// Usa o que existir: named `auth`, default export ou fallback
const authMW = Auth.auth || Auth.default || fallbackAuth;

/**
 * GET /api/subscription/status
 * Retorna status de assinatura do usuário autenticado.
 */
router.get("/status", authMW, async (req, res) => {
  try {
    const client = await getClientByUserId(req.db, req.user.id);
    if (!client) {
      return res.json({ active: false, status: "no_subscription" });
    }

    const expired = isExpired(client);
    const daysRemaining = computeDaysRemaining(client.start_date, client.end_date);

    return res.json({
      active: !expired,
      status: !expired ? "active" : "expired",
      // campos redundantes para compatibilidade com o front:
      plan: client.plan_id,
      plan_id: client.plan_id,
      planId: client.plan_id,
      planName: client.plan_name,
      is_free: !!client.is_free,
      start_date: client.start_date,
      end_date: client.end_date,
      startDate: client.start_date,
      endDate: client.end_date,
      daysRemaining,
      trial_days_left: daysRemaining,
      modules: client.modules || {},
    });
  } catch (err) {
    req?.log?.error?.({ err }, "SUBSCRIPTION_STATUS error");
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/subscription/start-trial
 * (Opcional) Inicia/renova o trial do plano FREE com base no `trial_days` do plano.
 */
router.post("/start-trial", authMW, async (req, res) => {
  const db = req.db;
  let client;
  try {
    // Lê trial_days do plano FREE (fallback 14)
    let trialDays = 14;
    try {
      const planRes = await db.query(
        `SELECT trial_days FROM public.plans WHERE id = 'free' LIMIT 1`
      );
      if (planRes.rows[0]?.trial_days != null) {
        const td = Number(planRes.rows[0].trial_days);
        if (Number.isFinite(td) && td >= 0) trialDays = td;
      }
    } catch (_) {}

    // Garante que exista um registro de cliente e aplica o período
    const upsertSql = `
      INSERT INTO public.clients (user_id, company_name, email, active, start_date, end_date, plan_id, is_free, created_at, updated_at)
      VALUES ($1,
              COALESCE((SELECT full_name FROM public.users WHERE id=$1),'Minha Empresa'),
              COALESCE((SELECT email FROM public.users WHERE id=$1),''),
              true,
              CURRENT_DATE,
              CURRENT_DATE + ($2 || ' days')::interval,
              'free',
              true,
              now(),
              now())
      ON CONFLICT (user_id) DO UPDATE SET
        active = EXCLUDED.active,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        plan_id = EXCLUDED.plan_id,
        is_free = EXCLUDED.is_free,
        updated_at = now()
      RETURNING id, user_id, plan_id, start_date, end_date, is_free
    `;
    const { rows } = await db.query(upsertSql, [req.user.id, String(trialDays)]);
    client = rows[0];

    const daysRemaining = computeDaysRemaining(client.start_date, client.end_date);

    // emite sucesso
    return res.status(200).json({
      ok: true,
      active: true,
      status: "active",
      plan: client.plan_id,
      plan_id: client.plan_id,
      is_free: !!client.is_free,
      start_date: client.start_date,
      end_date: client.end_date,
      daysRemaining,
      trial_days_left: daysRemaining,
    });
  } catch (err) {
    req?.log?.error?.({ err }, "START_TRIAL error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

