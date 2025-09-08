// backend/lib/subscription.js
import { query as rootQuery } from "../config/db.js";

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function getClientByUserId(db, userId) {
  const { rows } = await q(db)(
    `SELECT c.*, p.name AS plan_name, p.modules, p.is_free, p.trial_days, p.billing_period_months
       FROM clients c
       LEFT JOIN plans p ON p.id = c.plan_id
      WHERE c.user_id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export function computeDaysRemaining(startDate, endDate) {
  if (!endDate) return null;
  const today = new Date();
  const end = new Date(endDate);
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isExpired(client) {
  if (!client?.active) return true;
  if (!client.end_date) return false;
  return new Date(client.end_date) < new Date();
}

/** define ciclo mensal atual (1º dia do mês até último) */
export function currentMonthlyWindow(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // último dia
  return { start, end };
}
