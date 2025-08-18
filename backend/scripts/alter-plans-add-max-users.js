// backend/scripts/setup-plans-meta.js
import "dotenv/config";
import { query, closePool } from "../config/db.js";

(async () => {
  try {
    // cria tabela auxiliar
    await query(`
      CREATE TABLE IF NOT EXISTS public.plans_meta (
        plan_id TEXT PRIMARY KEY,
        max_users INTEGER NOT NULL DEFAULT 1
      )
    `);

    // backfill: adiciona linha default para planos existentes que ainda não tenham meta
    await query(`
      INSERT INTO public.plans_meta (plan_id, max_users)
      SELECT p.id, 1
      FROM public.plans p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.plans_meta m WHERE m.plan_id = p.id
      )
    `);

    console.log("✅ plans_meta criada e populada (default max_users=1).");
  } catch (e) {
    console.error("❌ Falha:", e.message);
    process.exitCode = 1;
  } finally {
    await closePool?.();
  }
})();
