// backend/routes/auth.js (ESM)
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "../config/db.js"; // use seu helper (pool.query)

const router = Router();

function signToken(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * POST /api/auth/login
 * body: { email, password, org_id? }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, org_id: requestedOrgId } = req.body;

    // 1) usuário
    const { rows: userRows } = await query(
      `SELECT id, name, email, password_hash, role, is_support, support_scopes
         FROM public.users
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    const user = userRows[0];
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    // 2) senha (bcrypt)
    if (!user.password_hash) {
      return res.status(401).json({ error: "password_not_set" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    // 3) org ativa + role/perms por org (user_orgs)
    const { rows: orgRows } = await query(
      `SELECT uo.org_id, uo.role, COALESCE(uo.perms, '{}'::jsonb) AS perms
         FROM public.user_orgs uo
        WHERE uo.user_id = $1`,
      [user.id]
    );

    if (orgRows.length === 0 && !user.is_support && user.role !== "SuperAdmin") {
      return res.status(403).json({ error: "no_org_assigned" });
    }

    // Escolhe org_id: prioridade para a requisitada; senão, a 1ª da lista; para Support/SuperAdmin é opcional
    const activeOrg =
      (requestedOrgId && orgRows.find(r => r.org_id === requestedOrgId)) ||
      orgRows[0] ||
      null;

    const org_id = activeOrg?.org_id || null;
    const role = activeOrg?.role || user.role || "OrgViewer";
    const perms = activeOrg?.perms || {};

    // 4) monta payload exatamente como você definiu
    const payload = {
      sub: user.id,
      org_id,                 // pode ser null para Support/SuperAdmin (impersonação depois)
      role,                   // OrgViewer|OrgAgent|OrgAdmin|OrgOwner|Support|SuperAdmin
      perms,                  // { marketing: { canDraft, canPublish, canApprove } }
      is_support: !!user.is_support,
      support_scopes: user.support_scopes || [],
    };

    const token = signToken(payload);

    // 5) resposta
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        org_id,
        role,
        perms,
        is_support: !!user.is_support,
        support_scopes: user.support_scopes || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
