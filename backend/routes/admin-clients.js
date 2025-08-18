import express from "express";
import { query } from "../config/db.js";
import { requireAuth, requireAdmin } from "../helpers/auth.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

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
