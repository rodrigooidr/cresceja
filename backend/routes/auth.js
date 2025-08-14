// backend/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'segredo'; // defina no .env em produção
const normEmail = (s) => String(s || '').trim().toLowerCase();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

/**
 * POST /api/auth/register
 * Cria usuário com hash feito pelo Postgres: crypt($senha, gen_salt('bf', 12))
 */
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password } = registerSchema.parse(req.body || {});
    const emailN = normEmail(email);

    await client.query('BEGIN');

    const exists = await client.query(
      'SELECT 1 FROM public.users WHERE email = $1',
      [emailN]
    );
    if (exists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const insertSql = `
      INSERT INTO public.users (email, full_name, role, password_hash, created_at, updated_at)
      VALUES ($1, $2, 'agent', crypt($3, gen_salt('bf', 12)), now(), now())
      RETURNING id, email, full_name, role
    `;
    const { rows } = await client.query(insertSql, [emailN, name.trim(), password]);
    await client.query('COMMIT');

    const user = rows[0];
    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch {}
    if (err?.issues) {
      return res.status(400).json({ error: 'payload_invalido', details: err.issues });
    }
    console.error('REGISTER error:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/login
 * Verifica a senha usando crypt($senha, password_hash) no Postgres.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body || {});
    const emailN = normEmail(email);

    const q = `
      SELECT id, email, full_name, role
        FROM public.users
       WHERE email = $1
         AND password_hash = crypt($2, password_hash)
       LIMIT 1
    `;
    const { rows } = await pool.query(q, [emailN, password]);

    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];
    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ error: 'payload_invalido', details: err.issues });
    }
    console.error('LOGIN error:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
