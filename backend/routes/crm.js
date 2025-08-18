import express from "express";
import { authRequired } from "../middleware/auth.js";
const r = express.Router();

r.get("/crm/opportunities", authRequired, (_req, res)=> res.json([]));

export default r;
