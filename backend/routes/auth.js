import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { query as fallbackQuery } from '#db';
import { auth as authRequired } from '../middleware/auth.js';
import { normalizeOrgRole, normalizeGlobalRoles } from '../lib/permissions.js';

export const authRouter = express.Router();

function resolveQuery(req) {
  if (req?.db?.query && typeof req.db.query === 'function') {
    return req.db.query.bind(req.db);
  }
  return fallbackQuery;
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-change-me';
  const expiresIn = process.env.JWT_EXPIRES_IN || '12h';
  return jwt.sign(payload, secret, { expiresIn });
}

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'Email e senha são obrigatórios.' });
    }

    const loweredEmail = String(email).trim().toLowerCase();
    const dbQuery = resolveQuery(req);
    const result = await dbQuery(
      'SELECT id, email, password_hash, name, org_id, roles FROM users WHERE email = $1 LIMIT 1',
      [loweredEmail],
    );
    const user = result?.rows?.[0];

    if (!user) {
      req.log?.warn({ email: loweredEmail }, 'auth.login.invalid_user');
      return res
        .status(401)
        .json({ error: 'unauthenticated', message: 'Credenciais inválidas.' });
    }

    if (!user.password_hash) {
      req.log?.warn({ userId: user.id, email: loweredEmail }, 'auth.login.no_password_hash');
      return res
        .status(401)
        .json({ error: 'unauthenticated', message: 'Credenciais inválidas.' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      req.log?.warn({ email: loweredEmail, userId: user.id }, 'auth.login.invalid_password');
      return res
        .status(401)
        .json({ error: 'unauthenticated', message: 'Credenciais inválidas.' });
    }

    const roles = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === 'string'
      ? [user.roles]
      : [];

    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      org_id: user.org_id,
      role: roles?.[0] || null,
      roles,
    };

    const token = signToken(payload);

    return res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: user.org_id },
      roles,
    });
  } catch (err) {
    req.log?.error({ err }, 'auth.login_failed');
    return res.status(500).json({ error: 'server_error', message: 'Falha ao autenticar.' });
  }
});

authRouter.get('/me', authRequired, (req, res) => {
  const user = req.user || {};
  const id = user.id || user.sub || null;
  const payload = {
    sub: user.sub || id,
    id,
    email: user.email || null,
    name: user.name || null,
    org_id: user.org_id || null,
    role: normalizeOrgRole(user.role) || 'OrgViewer',
    roles: normalizeGlobalRoles(Array.isArray(user.roles) ? user.roles : []),
  };
  res.json(payload);
});

export default authRouter;
