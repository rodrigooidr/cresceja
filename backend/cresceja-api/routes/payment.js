const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // npm i node-fetch@2

// Mercado Pago - criar link de pagamento
router.post('/mercadopago', async (req, res) => {
  const { userId, plan, price } = req.body;
  const mpToken = process.env.MERCADO_PAGO_TOKEN;
  const body = {
    items: [{
      title: `Plano ${plan} CresceJá`,
      quantity: 1,
      currency_id: "BRL",
      unit_price: price
    }],
    external_reference: String(userId),
    notification_url: process.env.MP_WEBHOOK_URL
  };
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mpToken}` },
    body: JSON.stringify(body)
  });
  const json = await r.json();
  res.json({ link: json.init_point });
});

// PagSeguro - criar link de pagamento (simples)
router.post('/pagseguro', async (req, res) => {
  // (É mais complexo em produção, mas aqui exemplo inicial)
  res.json({ message: "Integração PagSeguro a configurar" });
});

// Webhook Mercado Pago (atualiza assinatura)
router.post('/mp-webhook', async (req, res) => {
  // Exemplo: ao receber notificação, ative plano do user
  const externalRef = req.body?.data?.external_reference;
  if (externalRef) {
    // Aqui você checa o status real via API MP e ativa assinatura do usuário
    // await ... (update subscription)
  }
  res.sendStatus(200);
});

module.exports = router;