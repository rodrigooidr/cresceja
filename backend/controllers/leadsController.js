import { query } from '../config/db.js';

export async function listLeads(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { rows } = await query(
      `SELECT id, nome, email, telefone, origem, status, created_at
         FROM leads
        ORDER BY id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function createLead(req, res, next) {
  try {
    const { nome, email, telefone, origem } = req.body || {};
    if (!nome || !telefone) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { rows } = await query(
      `INSERT INTO leads (nome, email, telefone, origem, status)
       VALUES ($1,$2,$3,$4,'novo')
       RETURNING id, nome, email, telefone, origem, status, created_at`,
      [nome, email || null, telefone, origem || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}
