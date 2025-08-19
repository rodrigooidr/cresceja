// backend/routes/leads.js
import { Router } from "express";
import { query } from "../config/db.js"; // mantém o mesmo helper usado no server.js
import { authRequired } from "../middleware/auth.js";

const router = Router();

// garante que a tabela possua as colunas mais recentes
async function ensureLeadsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      score INTEGER NOT NULL DEFAULT 0,
      interests TEXT,
      last_interaction TIMESTAMP,
      sdr TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  await query(
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'novo';`
  );
  await query(
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;`
  );
  await query(
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS interests TEXT;`
  );
  await query(
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMP;`
  );
  await query(
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sdr TEXT;`
  );
}

// validação mínima
function validateLead(body) {
  const errors = [];
  const name = (body?.name || "").toString().trim();
  const email = (body?.email || "").toString().trim();
  const whatsapp = (body?.whatsapp || "").toString().trim();
  const source = (body?.channel || body?.source || "landing").toString().trim();
  const status = (body?.status || "novo").toString().trim();

  if (!name) errors.push("name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("valid email is required");

  return {
    ok: errors.length === 0,
    errors,
    data: { name, email, whatsapp, source, status },
  };
}

// POST /api/leads
router.post("/", async (req, res, next) => {
  try {
    const v = validateLead(req.body);
    if (!v.ok) return res.status(400).json({ error: "bad_request", details: v.errors });

    // garante tabela (idempotente)
    await ensureLeadsTable();

    const { rows } = await query(
      `INSERT INTO public.leads (name, email, whatsapp, source, status)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, whatsapp, source, status, score, interests, last_interaction, sdr, created_at`,
      [v.data.name, v.data.email, v.data.whatsapp, v.data.source, v.data.status]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads (lista últimos 50 p/ conferência)
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, name, email, whatsapp, source, status, score, interests, last_interaction, sdr, created_at
        FROM public.leads
    ORDER BY id DESC
       LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/:id/qualify - atualiza pontuação e dados de qualificação
router.put("/:id/qualify", authRequired, async (req, res, next) => {
  try {
    await ensureLeadsTable();
    const { id } = req.params;
    const { score, interests, status, sdr } = req.body || {};
    const lastInteraction = new Date();
    await query(
      `UPDATE public.leads
         SET score = COALESCE($1, score),
             interests = COALESCE($2, interests),
             status = COALESCE($3, status),
             sdr = COALESCE($4, sdr),
             last_interaction = $5
       WHERE id = $6`,
      [score, interests, status, sdr, lastInteraction, id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router; // <<< IMPORTANTE: default export (resolve o erro)
