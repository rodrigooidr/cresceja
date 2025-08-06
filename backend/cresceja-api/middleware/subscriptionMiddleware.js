const pool = require('../db');

async function requireActiveSubscription(req, res, next) {
  const result = await pool.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [req.user.id]
  );
  const sub = result.rows[0];
  const now = new Date();

  if (!sub) return res.status(402).json({ error: "Assinatura não encontrada" });
  if (sub.status === "trial" && new Date(sub.trial_until) > now) return next();
  if (sub.status === "active" && new Date(sub.active_until) > now) return next();
  return res.status(402).json({ error: "Plano vencido ou bloqueado" });
}

module.exports = { requireActiveSubscription };