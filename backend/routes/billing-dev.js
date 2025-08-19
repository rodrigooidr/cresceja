import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../helpers/auth.js";

const router = express.Router();
router.use(requireAuth);

const DEV_MODE = String(process.env.BILLING_DEV_MODE || "false").toLowerCase() === "true";

async function getPlan(planId) {
  const { rows } = await query(`
    SELECT id, name, monthly_price AS "monthlyPrice", currency
    FROM plans WHERE id = $1
  `, [planId]);
  return rows[0] || null;
}

// POST /api/billing/checkout  -> se DEV_MODE, redireciona direto para success_url
router.post("/checkout", async (req, res) => {
  const { plan_id, success_url, cancel_url, provider } = req.body || {};
  if (!plan_id) return res.status(400).json({ message: "plan_id é obrigatório" });
  if (!success_url || !cancel_url) return res.status(400).json({ message: "success_url e cancel_url são obrigatórios" });

  try {
    const plan = await getPlan(plan_id);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });
  } catch (err) {
    // Mesmo que o plano ainda não exista, em DEV podemos seguir
    if (!DEV_MODE) return res.status(500).json({ message: "Erro ao consultar plano" });
  }

  if (DEV_MODE) {
    const sid = `dev_${Date.now()}`;
    const url = success_url.includes("?") ? `${success_url}&session_id=${sid}&plan=${plan_id}&dev=1` : `${success_url}?session_id=${sid}&plan=${plan_id}&dev=1`;
    return res.json({ checkout_url: url, session_id: sid, dev: true });
  }

  // Modo produção: tenta Stripe ou Mercado Pago (igual ao billing.js original)
  try {
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
            { title: `Assinatura ${plan_id}`, quantity: 1, currency_id: "BRL", unit_price: 0 }
          ],
          back_urls: { success: success_url, failure: cancel_url, pending: cancel_url },
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

    return res.status(501).json({ message: "Nenhum provedor de pagamento configurado e DEV_MODE desativado" });
  } catch (err) {
    console.error("POST /billing/checkout", err);
    res.status(500).json({ message: "Falha ao iniciar checkout" });
  }
});

// GET /api/billing/verify  -> em DEV_MODE sempre 'paid'
router.get("/verify", async (req, res) => {
  if (DEV_MODE) return res.json({ status: "paid", dev: true });

  const { session_id, payment_id, plan } = req.query || {};
  try {
    if (session_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = (await import("stripe")).default;
      const client = stripe(process.env.STRIPE_SECRET_KEY);
      const session = await client.checkout.sessions.retrieve(session_id);
      if (session && (session.payment_status === "paid" || session.status === "complete")) {
        return res.json({ status: "paid" });
      }
      return res.json({ status: "pending" });
    }
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
    return res.json({ status: "unknown" });
  } catch (err) {
    console.error("GET /billing/verify", err);
    res.status(500).json({ message: "Erro ao verificar pagamento" });
  }
});

export default router;
