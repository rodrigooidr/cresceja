import express from "express";
import { query } from "../config/db.js";

const router = express.Router();

// STRIPE WEBHOOK (montar com body raw no server.js)
router.post("/stripe", async (req, res) => {
  try {
    const stripe = (await import("stripe")).default;
    const client = stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = client.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Stripe webhook signature verification failed", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const planId = session.metadata?.plan_id;

      if (userId && planId) {
        await activateSubscription(userId, planId);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("POST /webhooks/stripe", err);
    res.status(500).json({ message: "Erro no webhook Stripe" });
  }
});

// MERCADO PAGO WEBHOOK
router.post("/mercadopago", async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const data = req.body?.data || {};
    // Para pagamentos: verificar status via API e ativar
    if ((type === "payment" || req.body?.action === "payment.updated") && data.id) {
      const fetch = (await import("node-fetch")).default;
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const pay = await r.json();
      if (pay.status === "approved") {
        const userId = pay.metadata?.user_id;
        const planId = pay.metadata?.plan_id;
        if (userId && planId) {
          await activateSubscription(userId, planId);
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("POST /webhooks/mercadopago", err);
    res.status(500).json({ message: "Erro no webhook Mercado Pago" });
  }
});

async function activateSubscription(userId, planId) {
  // Define ativo, datas e plano do cliente vinculado ao userId
  await query(`
    UPDATE clients
       SET active = true,
           start_date = COALESCE(start_date, CURRENT_DATE),
           end_date = GREATEST(COALESCE(end_date, CURRENT_DATE), CURRENT_DATE) + INTERVAL '30 days',
           plan_id = $2,
           updated_at = now()
     WHERE user_id = $1
  `, [userId, planId]);
}

export default router;
