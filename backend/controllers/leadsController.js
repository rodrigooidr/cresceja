import { query } from '../config/db.js';

export async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await query('SELECT COUNT(*) FROM leads');
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await query(
      `SELECT id, nome, email, telefone, origem, status, created_at
         FROM leads
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { nome, email, telefone, origem } = req.body || {};
    if (!nome || !telefone) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const allowedOrigem = ['site', 'whatsapp', 'instagram', 'outros'];
    const origemVal = allowedOrigem.includes(origem) ? origem : null;

    const { rows } = await query(
      `INSERT INTO leads (nome, email, telefone, origem, status)
       VALUES ($1,$2,$3,$4,'novo')
       RETURNING id, nome, email, telefone, origem, status, created_at`,
      [nome, email || null, telefone, origemVal]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}
