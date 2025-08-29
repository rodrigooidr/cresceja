import express from "express";
import { auth as authRequired } from "../middleware/auth.js";
import { query } from "../config/db.js";

const r = express.Router();

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'novo';`);
  await query(`
    CREATE TABLE IF NOT EXISTS public.crm_opportunities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES public.leads(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT,
      whatsapp TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
}

// Lista oportunidades com canal de origem
r.get("/oportunidades", authRequired, async (req, res, next) => {
  try {
    await ensureTables();
    const { status } = req.query || {};
    const params = [];
    let where = "";
    if (status) {
      params.push(status);
      where = "WHERE o.status = $1";
    }
    const { rows } = await query(
      `SELECT o.id, o.name, o.email, o.whatsapp, o.status, l.source AS channel, o.created_at
       FROM public.crm_opportunities o
       LEFT JOIN public.leads l ON l.id = o.lead_id
       ${where}
       ORDER BY o.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Cria oportunidade + lead com canal
r.post("/oportunidades", authRequired, async (req, res, next) => {
  try {
    const { name, email, whatsapp, channel } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "missing_fields" });
    await ensureTables();
    const leadRes = await query(
      `INSERT INTO public.leads (name, email, whatsapp, source)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [name, email, whatsapp, channel]
    );
    const leadId = leadRes.rows[0].id;
    const oppRes = await query(
      `INSERT INTO public.crm_opportunities (lead_id, name, email, whatsapp)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [leadId, name, email, whatsapp]
    );
    res.status(201).json({ id: oppRes.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// Converte um lead existente em oportunidade
r.post("/leads/:id/move", authRequired, async (req, res, next) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const leadRes = await query(
      `SELECT id, name, email, whatsapp FROM public.leads WHERE id = $1`,
      [id]
    );
    if (leadRes.rows.length === 0)
      return res.status(404).json({ error: "not_found" });
    const lead = leadRes.rows[0];
    const oppRes = await query(
      `INSERT INTO public.crm_opportunities (lead_id, name, email, whatsapp)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [lead.id, lead.name, lead.email, lead.whatsapp]
    );
    await query(
      `UPDATE public.leads SET status = 'oportunidade' WHERE id = $1`,
      [id]
    );
    res.status(201).json({ id: oppRes.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// Atualiza status da oportunidade
r.put("/oportunidades/:id", authRequired, async (req, res, next) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { status } = req.body || {};
    await query(
      `UPDATE public.crm_opportunities SET status = $1 WHERE id = $2`,
      [status, id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default r;
