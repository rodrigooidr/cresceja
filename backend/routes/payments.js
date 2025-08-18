import express from "express";
import { authOptional } from "../middleware/auth.js";
const r = express.Router();

r.post("/billing/checkout", authOptional, (req, res)=>{
  // demo: devolve uma URL fake ou session id
  const plan = req.body?.plan_id || "starter";
  return res.json({ checkout_url: `https://example.com/pay?plan=${encodeURIComponent(plan)}` });
});
r.post("/payments/checkout", authOptional, (req, res)=>{
  return res.json({ session_id: "sess_demo_123" });
});

export default r;
