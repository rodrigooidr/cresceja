// backend/routes/public.js
import express from 'express';
import { query as rootQuery } from '#db';

const router = express.Router();

router.get('/plans', async (_req, res) => {
  try {
    const sql = `
      SELECT
        p.id,
        p.name,
        -- converte centavos p/ número, com fallback 0
        (COALESCE(p.price_cents, 0) / 100.0)::numeric AS "monthlyPrice",
        COALESCE(p.currency, 'BRL')                  AS currency,
        COALESCE(p.modules, '[]'::jsonb)             AS modules,
        COALESCE(p.is_published, true)               AS "is_published",
        p.sort_order                                 AS "sort_order",
        COALESCE(p.is_free, false)                   AS "is_free",
        COALESCE(p.trial_days, 0)                    AS "trial_days",
        COALESCE(p.billing_period_months, 1)         AS "billing_period_months",
        COALESCE(pm.max_users, 1)                    AS "max_users"
      FROM public.plans p
      LEFT JOIN public.plans_meta pm ON pm.plan_id = p.id
      -- se não existir is_published, o COALESCE(true) acima garante exibição
      WHERE COALESCE(p.is_published, true) = TRUE
      ORDER BY p.sort_order NULLS LAST, p.id
    `;

    let rows = [];
    try {
      const r = await rootQuery(sql);
      rows = r.rows ?? [];
    } catch {
      // Fallback seguro para não quebrar o frontend se a tabela ainda não existir
      rows = [
        {
          id: 'free',
          name: 'Free',
          monthlyPrice: 0,
          currency: 'BRL',
          modules: [],
          is_published: true,
          sort_order: 999999,
          is_free: true,
          trial_days: 0,
          billing_period_months: 1,
          max_users: 1,
        },
      ];
    }

    // ✅ Compatível com o front (data) e mantém plans para quem já usa
    res.json({ data: rows, plans: rows });
  } catch (e) {
    console.error('GET /api/public/plans error', e);
    // Nunca devolve 500 para público: retorna vazio
    res.json({ data: [], plans: [] });
  }
});

export default router;
