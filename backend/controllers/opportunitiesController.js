import { query } from '../config/db.js';

export async function listOpportunities(req, res, next) {
  try {
    const { status } = req.query || {};
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = 'WHERE status = $1';
    }
    const { rows } = await query(
      `SELECT id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at
         FROM opportunities
         ${where}
        ORDER BY id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function createOpportunity(req, res, next) {
  try {
    const { lead_id, cliente, valor_estimado, responsavel } = req.body || {};
    if (!cliente) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { rows } = await query(
      `INSERT INTO opportunities (lead_id, cliente, valor_estimado, responsavel)
       VALUES ($1,$2,$3,$4)
       RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      [lead_id || null, cliente, typeof valor_estimado === 'number' ? valor_estimado : 0, responsavel || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateOpportunity(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'invalid_input' });
    const { rows } = await query(
      `UPDATE opportunities
          SET status = $1,
              updated_at = NOW()
        WHERE id = $2
      RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
