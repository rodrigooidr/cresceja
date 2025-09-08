// backend/middleware/entitlements.js
import { query as rootQuery } from "../config/db.js";
import { currentMonthlyWindow, getClientByUserId, isExpired } from "../lib/subscription.js";

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function requireActiveSubscription(req, res, next) {
  try {
    const client = await getClientByUserId(req.db, req.user.id);
    if (!client) return res.status(403).json({ error: "client_not_found" });
    if (isExpired(client)) return res.status(402).json({ error: "subscription_expired" });
    req.client = client;
    return next();
  } catch (e) {
    return res.status(500).json({ error: "subscription_check_failed" });
  }
}

/**
 * Verifica se módulo está habilitado e quota disponível (consome quota se ok).
 * moduleKey ex.: "omnichannel", metricKey ex.: "chat_sessions"
 * inc: quanto consumir (ex.: 1)
 */
export function requireEntitlement(moduleKey, metricKey, inc = 1) {
  return async (req, res, next) => {
    try {
      const client = req.client; // precisa ter passado por requireActiveSubscription
      const planModules = client.modules || {};
      const mod = planModules[moduleKey];
      if (!mod?.enabled) return res.status(403).json({ error: "module_disabled" });

      const quota = mod[metricKey]; // ex.: 50 chats / mês
      if (quota == null) return next(); // sem quota => ilimitado

      const { start, end } = currentMonthlyWindow(new Date());
      const periodStart = start.toISOString().slice(0, 10);
      const periodEnd = end.toISOString().slice(0, 10);

      // upsert do contador
      const { rows } = await q(req.db)(
        `INSERT INTO usage_counters (client_id, module_key, period_start, period_end, used, quota)
         VALUES ($1, $2, $3, $4, 0, $5)
         ON CONFLICT (client_id, module_key, period_start, period_end)
         DO UPDATE SET quota = EXCLUDED.quota
         RETURNING id, used, quota`,
        [client.id, moduleKey, periodStart, periodEnd, quota]
      );

      const row = rows[0];
      if (Number(row.used) + inc > Number(row.quota)) {
        return res.status(403).json({ error: "quota_exceeded", module: moduleKey });
      }

      await q(req.db)(`UPDATE usage_counters SET used = used + $1 WHERE id = $2`, [inc, row.id]);
      return next();
    } catch (e) {
      return res.status(500).json({ error: "entitlement_check_failed" });
    }
  };
}
