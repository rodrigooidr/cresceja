const express = require('express');
const { createSubscription, updateSubscriptionStatus } = require('../models/subscriptionModel');
const authenticateToken = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/webhook/mp', async (req, res) => {
  const { userId, status, expiresAt } = req.body;
  await updateSubscriptionStatus(userId, status);
  res.sendStatus(200);
});

router.get('/subscribe-test', authenticateToken, async (req, res) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createSubscription(req.user.id, 'active', expiresAt);
  res.json({ message: 'Plano de teste ativado com sucesso!' });
});

module.exports = router;