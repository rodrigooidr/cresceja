const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const Subscription = require('../models/subscriptionModel');

// Consulta assinatura do usuário logado
router.get('/me', authenticateToken, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ status: 'none', plan: 'Free' });
  res.json(result.rows[0]);
});

// Cria trial manualmente (caso precise)
router.post('/trial', authenticateToken, async (req, res) => {
  const trialUntil = new Date();
  trialUntil.setDate(trialUntil.getDate() + 14);
  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, trial_until) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, 'Pro', 'trial', trialUntil]
  );
  res.status(201).json(result.rows[0]);
});

// Atualiza status após pagamento (webhook chama essa rota)
router.post('/activate/:userId', async (req, res) => {
  const { userId } = req.params;
  const now = new Date();
  const activeUntil = new Date();
  activeUntil.setMonth(activeUntil.getMonth() + 1); // 1 mês de assinatura
  await pool.query(
    `UPDATE subscriptions SET status = 'active', trial_until = NULL, active_until = $1 WHERE user_id = $2`,
    [activeUntil, userId]
  );
  res.json({ ok: true });
});

// Iniciar teste gratuito
router.post('/start-trial', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verifica se já existe uma assinatura
    const existing = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Você já possui uma assinatura.' });
    }

    // Cria assinatura de teste gratuita de 7 dias
    const trialUntil = new Date();
    trialUntil.setDate(trialUntil.getDate() + 7);

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, trial_until) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, 'Pro', 'trial', trialUntil]
    );

    res.status(201).json({ message: 'Teste gratuito ativado com sucesso.', data: result.rows[0] });

  } catch (err) {
    console.error('Erro ao iniciar teste gratuito:', err);
    res.status(500).json({ message: 'Erro ao iniciar teste gratuito.' });
  }
});

module.exports = router;
