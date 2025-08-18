import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").toString().trim().toLowerCase();
    const password = (req.body?.password || req.body?.senha || "").toString();

    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    const { rows } = await query(
      "SELECT id, email, role, password_hash FROM public.users WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "invalid_credentials" });

    const ok = !!u.password_hash && (await bcrypt.compare(password, u.password_hash));
    if (!ok) {
      if (process.env.NODE_ENV !== "production") {
        req.log?.info({ email, has_hash: !!u.password_hash }, "auth/login failed");
      }
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const token = jwt.sign(
      { sub: u.id, role: u.role },
      process.env.JWT_SECRET || "segredo",
      { expiresIn: "7d" }
    );

    try { await query("UPDATE public.users SET last_login_at = NOW() WHERE id = $1", [u.id]); } catch {}
    return res.json({ token, user: { id: u.id, email: u.email, role: u.role } });
  } catch (e) {
    req.log?.error({ err: e, email: req.body?.email }, "auth/login error");
    next(e);
  }
});

export default router;
