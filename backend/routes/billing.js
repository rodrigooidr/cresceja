import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../helpers/auth.js";

const router = express.Router();
router.use(requireAuth);

// Helper to get plan from DB
async function getPlan(planId) {
  const { rows } = await query(`
    SELECT id, name, monthly_price AS "monthlyPrice", currency
    FROM plans WHERE id = $1
  `, [planId]);
  return rows[0] || null;
}

// POST /api/billing/checkout { plan_id, success_url, cancel_url, provider? }
router.post("/checkout", async (req, res) => {
  const { plan_id, success_url, cancel_url, provider } = req.body || {};
  if (!plan_id) return res.status(400).json({ message: "plan_id é obrigatório" });
  if (!success_url || !cancel_url) return res.status(400).json({ message: "success_url e cancel_url são obrigatórios" });

  try {
    const plan = await getPlan(plan_id);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    // Preferência: Stripe se tiver chave, senão Mercado Pago
    const preferStripe = !!process.env.STRIPE_SECRET_KEY;
    const preferMP = !!process.env.MP_ACCESS_TOKEN;
    const use = (provider || "").toLowerCase();
    const byUser = use === "stripe" || use === "mercadopago";

    if ((byUser && use === "stripe") || (!byUser && preferStripe)) {
      const stripe = (await import("stripe")).default;
      const client = stripe(process.env.STRIPE_SECRET_KEY);
      const priceMap = {
        starter: process.env.STRIPE_PRICE_ID_STARTER,
        pro: process.env.STRIPE_PRICE_ID_PRO,
        business: process.env.STRIPE_PRICE_ID_BUSINESS,
      };
      const price = priceMap[plan_id];
      if (!price) return res.status(500).json({ message: "Mapeie os PRICE_IDs no .env" });

      const session = await client.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url,
        cancel_url,
        metadata: { user_id: req.user.id, plan_id },
      });
      return res.json({ checkout_url: session.url, session_id: session.id });
    }

    if ((byUser && use === "mercadopago") || (!byUser && preferMP)) {
      const fetch = (await import("node-fetch")).default;
      const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: [
            {
              title: `Assinatura ${plan.name}`,
              quantity: 1,
              currency_id: plan.currency || "BRL",
              unit_price: Number(plan.monthlyPrice) || 0
            }
          ],
          back_urls: {
            success: success_url,
            failure: cancel_url,
            pending: cancel_url
          },
          auto_return: "approved",
          metadata: { user_id: req.user.id, plan_id }
        })
      });
      const data = await resp.json();
      if (!data.init_point && !data.sandbox_init_point) {
        return res.status(500).json({ message: "Resposta do Mercado Pago sem init_point", raw: data });
      }
      return res.json({ checkout_url: data.init_point || data.sandbox_init_point, init_point: data.init_point });
    }

    return res.status(500).json({ message: "Nenhum provedor de pagamento configurado" });
  } catch (err) {
    console.error("POST /billing/checkout", err);
    res.status(500).json({ message: "Falha ao iniciar checkout" });
  }
});

// GET /api/billing/verify?session_id&payment_id&plan
router.get("/verify", async (req, res) => {
  const { session_id, payment_id, plan } = req.query || {};
  try {
    // Stripe verification
    if (session_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = (await import("stripe")).default;
      const client = stripe(process.env.STRIPE_SECRET_KEY);
      const session = await client.checkout.sessions.retrieve(session_id);
      if (session && (session.payment_status === "paid" || session.status === "complete")) {
        return res.json({ status: "paid" });
      }
      return res.json({ status: "pending" });
    }
    // Mercado Pago verification
    if (payment_id && process.env.MP_ACCESS_TOKEN) {
      const fetch = (await import("node-fetch")).default;
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const data = await r.json();
      if (data && data.status === "approved") {
        return res.json({ status: "paid" });
      }
      return res.json({ status: data?.status || "pending" });
    }
    // Fallback
    return res.json({ status: "unknown" });
  } catch (err) {
    console.error("GET /billing/verify", err);
    res.status(500).json({ message: "Erro ao verificar pagamento" });
  }
});

export default router;
