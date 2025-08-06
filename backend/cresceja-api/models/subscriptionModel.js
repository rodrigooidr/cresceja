const pool = require('../db');

async function createSubscription(userId, status, expiresAt) {
  return await pool.query(
    'INSERT INTO subscriptions (user_id, status, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, status, expiresAt]
  );
}

async function updateSubscriptionStatus(userId, status) {
  return await pool.query(
    'UPDATE subscriptions SET status = $1 WHERE user_id = $2 RETURNING *',
    [status, userId]
  );
}

module.exports = {
  createSubscription,
  updateSubscriptionStatus,
};