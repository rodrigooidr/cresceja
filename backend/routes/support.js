import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { query } from "../config/db.js";

const router = Router();

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.support_tickets (
      id SERIAL PRIMARY KEY,
      client TEXT NOT NULL,
      channel TEXT,
      agent TEXT,
      status TEXT NOT NULL DEFAULT 'aberto',
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
}

// lista últimos 50 atendimentos
router.get("/atendimentos", authRequired, async (_req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await query(
      `SELECT id, client, channel, agent, status, created_at
         FROM public.support_tickets
     ORDER BY id DESC
        LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// cria novo atendimento
router.post("/atendimentos", authRequired, async (req, res, next) => {
  try {
    await ensureTable();
    const { client, channel } = req.body || {};
    if (!client) return res.status(400).json({ error: "missing_fields" });
    const { rows } = await query(
      `INSERT INTO public.support_tickets (client, channel)
       VALUES ($1,$2)
       RETURNING id`,
      [client, channel]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

// atualiza status ou agente
router.put("/atendimentos/:id", authRequired, async (req, res, next) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { status, agent } = req.body || {};
    await query(
      `UPDATE public.support_tickets
          SET status = COALESCE($1, status),
              agent = COALESCE($2, agent)
        WHERE id = $3`,
      [status, agent, id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
