import express from "express";
import { query } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(authRequired, requireRole("owner"));

// GET /api/admin/clients
router.get("/clients", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, company_name, email, active, start_date, end_date, plan_id, modules, created_at, updated_at
      FROM clients
      ORDER BY created_at DESC NULLS LAST
    `);
    res.json({ clients: rows });
  } catch (err) {
    console.error("GET /admin/clients", err);
    // Fallback amigável
    res.json({ clients: [] });
  }
});

// POST /api/admin/clients
router.post("/clients", async (req, res) => {
  const {
    company_name,
    email,
    plan_id,
    start_date,
    end_date,
    auto,
    annual,
    annual_price,
  } = req.body || {};
  try {
    let start = start_date ? new Date(start_date) : null;
    let end = end_date ? new Date(end_date) : null;
    if (auto && plan_id) {
      const { rows } = await query(
        "SELECT is_free, trial_days, billing_period_months FROM plans WHERE id=$1 LIMIT 1",
        [plan_id]
      );
      const plan = rows[0] || {};
      start = new Date();
      if (plan.is_free) {
        const trial = Number(plan.trial_days || 14);
        end = new Date(Date.now() + trial * 86400 * 1000);
      } else {
        const months = annual ? 12 : Number(plan.billing_period_months || 1);
        end = new Date(start);
        end.setMonth(end.getMonth() + months);
      }
    }
    const modules = annual_price ? { annual_price } : null;
    const { rows } = await query(
      `INSERT INTO clients (company_name, email, active, start_date, end_date, plan_id, modules, created_at, updated_at)
       VALUES ($1, $2, true, $3::date, $4::date, $5, $6::jsonb, now(), now())
       RETURNING id`,
      [
        company_name,
        email,
        start ? start.toISOString().slice(0, 10) : null,
        end ? end.toISOString().slice(0, 10) : null,
        plan_id || null,
        modules ? JSON.stringify(modules) : null,
      ]
    );
    res.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    console.error("POST /admin/clients", err);
    res.status(500).json({ message: "Erro ao criar cliente" });
  }
});

// PUT /api/admin/clients/:id
router.put("/clients/:id", async (req, res) => {
  const id = req.params.id;
  const { active, start_date, end_date, plan_id, modules } = req.body || {};
  try {
    await query(
      `UPDATE clients SET
        active = COALESCE($1, active),
        start_date = COALESCE($2::date, start_date),
        end_date = COALESCE($3::date, end_date),
        plan_id = COALESCE($4, plan_id),
        modules = COALESCE($5::jsonb, modules),
        updated_at = now()
       WHERE id = $6`,
      [active, start_date, end_date, plan_id, modules ? JSON.stringify(modules) : null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /admin/clients/:id", err);
    res.status(500).json({ message: "Erro ao atualizar cliente" });
  }
});

export default router;
