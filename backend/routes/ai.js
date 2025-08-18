import express from "express";
import { authRequired } from "../middleware/auth.js";
const r = express.Router();

r.get("/ai/credits", authRequired, (_req, res)=> res.json({ remaining: 10000, monthly: 10000 }));
r.get("/ai/logs", authRequired, (_req, res)=> res.json([]));

export default r;
