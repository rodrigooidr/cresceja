// backend/routes/leads.js
import { Router } from "express";
import { query } from "../config/db.js"; // mantém o mesmo helper usado no server.js

const router = Router();

// validação mínima
function validateLead(body) {
  const errors = [];
  const name = (body?.name || "").toString().trim();
  const email = (body?.email || "").toString().trim();
  const whatsapp = (body?.whatsapp || "").toString().trim();
  const source = (body?.source || "landing").toString().trim();

  if (!name) errors.push("name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("valid email is required");

  return { ok: errors.length === 0, errors, data: { name, email, whatsapp, source } };
}

// POST /api/leads
router.post("/", async (req, res, next) => {
  try {
    const v = validateLead(req.body);
    if (!v.ok) return res.status(400).json({ error: "bad_request", details: v.errors });

    // garante tabela (idempotente)
    await query(`
      CREATE TABLE IF NOT EXISTS public.leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        whatsapp TEXT,
        source TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await query(
      `INSERT INTO public.leads (name, email, whatsapp, source)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, whatsapp, source, created_at`,
      [v.data.name, v.data.email, v.data.whatsapp, v.data.source]
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
      SELECT id, name, email, whatsapp, source, created_at
        FROM public.leads
    ORDER BY id DESC
       LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router; // <<< IMPORTANTE: default export (resolve o erro)
