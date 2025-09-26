// backend/routes/auth.js (ESM)
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from '#db';
import { auth as authRequired } from '../middleware/auth.js';
import { normalizeOrgRole, normalizeGlobalRoles } from '../lib/permissions.js';

const router = Router();

function signToken(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const expiresIn = process.env.JWT_EXPIRES_IN || "12h";
  return jwt.sign(payload, secret, { expiresIn });
}

function pickActiveMembership(memberships, requestedOrgId) {
  if (!memberships?.length) return null;
  if (requestedOrgId) {
    const match = memberships.find((m) => m.org_id === requestedOrgId);
    if (match) return match;
  }
  return memberships[0] || null;
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
      `SELECT id, name, email, password_hash
         FROM public.users
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    const user = userRows[0];
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    if (!user.password_hash) return res.status(401).json({ error: "password_not_set" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    // 2) organizações do usuário  
    const { rows: orgRows } = await query(
      `SELECT org_id, role
         FROM public.org_members
        WHERE user_id = $1
        ORDER BY created_at ASC`,
      [user.id]
    );

    const memberships = orgRows.map((row) => ({
      org_id: row.org_id,
      role: normalizeOrgRole(row.role),
    }));

    const activeMembership = pickActiveMembership(memberships, requestedOrgId);
    const activeOrgId = activeMembership?.org_id || null;
    const orgRole = normalizeOrgRole(activeMembership?.role);

    const { rows: globals } = await query(
      `SELECT role
         FROM public.user_global_roles
        WHERE user_id = $1
        ORDER BY created_at ASC`,
      [user.id]
    );

    const roles = normalizeGlobalRoles(globals.map((row) => row.role));

    if (!activeOrgId && !roles.length) {
      return res.status(403).json({ error: "no_org_assigned" });
    }

    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      org_id: activeOrgId,
      role: orgRole,
      roles,
    };

    const token = signToken(payload);

    // 5) resposta
    res.json({
      token,
      user: payload,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, (req, res) => {
  const user = req.user || {};
  const id = user.id || user.sub || null;
  const payload = {
    sub: user.sub || id,
    id,
    email: user.email || null,
    name: user.name || null,
    org_id: user.org_id || null,
    role: normalizeOrgRole(user.role),
    roles: normalizeGlobalRoles(Array.isArray(user.roles) ? user.roles : []),
  };
  res.json(payload);
});

export default router;
