import { Router } from 'express';
import { query } from '../config/db.js';
import { addDays } from '../services/subscription.js';

const router = Router();

router.get('/status', async (req, res) => {
  const userId = req.user.id;
  const r = await query('SELECT plan, status, trial_started_at, trial_ends_at FROM subscriptions WHERE user_id=$1', [userId]);
  const s = r.rows[0] || null;
  if (!s) return res.json({ plan: 'free', status: 'no_subscription' });
  const now = new Date();
  const diffMs = new Date(s.trial_ends_at) - now;
  const trial_days_left = s.trial_ends_at ? Math.max(0, Math.ceil(diffMs / 86400000)) : 0;
  res.json({ ...s, trial_days_left });
});

router.post('/start-trial', async (req, res) => {
  const userId = req.user.id;
  // se já tiver assinatura, não inicia trial
  const existing = await query('SELECT 1 FROM subscriptions WHERE user_id=$1', [userId]);
  if (existing.rowCount) {
    return res.status(400).json({ error: 'already_has_subscription' });
  }
  const trialEnds = addDays(new Date(), 14);
  await query(
    `INSERT INTO subscriptions (user_id, plan, status, trial_started_at, trial_ends_at) 
     VALUES ($1,'pro','trial', NOW(), $2)`,
    [userId, trialEnds.toISOString()]
  );
  res.status(201).json({ ok: true, trial_ends_at: trialEnds.toISOString() });
});

router.post('/change-plan', async (req, res) => {
  const userId = req.user.id;
  const plan = (req.body.plan || '').toLowerCase();
  if (!['free', 'pro', 'pro+', 'enterprise'].includes(plan)) return res.status(400).json({ error: 'invalid_plan' });
  await query('UPDATE subscriptions SET plan=$1, status=$2 WHERE user_id=$3', [plan, 'active', userId]);
  res.json({ ok: true });
});

// Webhook de pagamento (placeholder)
router.post('/webhook', async (req, res) => {
  console.log('subscription webhook', req.body);
  res.json({ received: true });
});

export default router;
