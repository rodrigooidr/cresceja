import express from "express";
import { authRequired, requireRole } from "../middleware/auth.js";
import { readDb, writeDb } from "../db.js";
import { normalizePlan } from "../utils/normalize.js";

const r = express.Router();

/** GET /api/admin/plans  – owner e client_admin */
r.get("/admin/plans", authRequired, requireRole("owner","client_admin"), (req, res)=>{
  const db = readDb();
  const t = db.tenants.find(t => t.id === req.user.tenantId);
  res.json({ plans: t?.plans || [] });
});

/** POST /api/admin/plans  – create/upsert (owner, client_admin) */
r.post("/admin/plans", authRequired, requireRole("owner","client_admin"), (req, res)=>{
  const p = normalizePlan(req.body || {});
  if (!p.id) return res.status(400).json({ error: "id_required" });
  const db = readDb();
  const t = db.tenants.find(t => t.id === req.user.tenantId);
  if (!t) return res.status(404).json({ error: "tenant_not_found" });
  const i = (t.plans||[]).findIndex(x => (x.id||"") === p.id);
  if (i >= 0) t.plans[i] = { ...t.plans[i], ...p }; else (t.plans ||= []).push(p);
  writeDb(db);
  res.json({ id: p.id, ok: true });
});

/** PATCH /api/admin/plans/:id – update (owner, client_admin) */
r.patch("/admin/plans/:id", authRequired, requireRole("owner","client_admin"), (req, res)=>{
  const id = req.params.id;
  const diff = normalizePlan({ ...req.body, id });
  const db = readDb();
  const t = db.tenants.find(t => t.id === req.user.tenantId);
  if (!t) return res.status(404).json({ error: "tenant_not_found" });
  const i = (t.plans||[]).findIndex(x => (x.id||"") === id);
  if (i < 0) return res.status(404).json({ error: "not_found" });
  t.plans[i] = { ...t.plans[i], ...diff };
  writeDb(db);
  res.json({ id, ok: true });
});

/** POST /api/admin/plans/:id/publish {is_published} */
r.post("/admin/plans/:id/publish", authRequired, requireRole("owner","client_admin"), (req, res)=>{
  const id = req.params.id;
  const { is_published } = req.body || {};
  const db = readDb();
  const t = db.tenants.find(t => t.id === req.user.tenantId);
  if (!t) return res.status(404).json({ error: "tenant_not_found" });
  const pl = (t.plans||[]).find(x => (x.id||"") === id);
  if (!pl) return res.status(404).json({ error: "not_found" });
  pl.is_published = !!is_published;
  writeDb(db);
  res.json({ id, is_published: pl.is_published, ok: true });
});

/** GET /api/subscription/status – qualquer usuário autenticado */
r.get("/subscription/status", authRequired, (req, res)=>{
  // demo simplificada
  res.json({ tenantId: req.user.tenantId, plan: "starter", status: "active" });
});

export default r;
