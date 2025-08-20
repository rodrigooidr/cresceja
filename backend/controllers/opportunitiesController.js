import { query } from '../config/db.js';

const STATUSES = ['prospeccao', 'contato', 'proposta', 'negociacao', 'fechamento'];

export async function board(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at
         FROM opportunities
        ORDER BY updated_at DESC, id DESC`
    );
    const grouped = {};
    STATUSES.forEach((s) => {
      grouped[s] = [];
    });
    rows.forEach((row) => {
      if (!grouped[row.status]) grouped[row.status] = [];
      grouped[row.status].push(row);
    });
    const counts = {};
    Object.keys(grouped).forEach((s) => {
      counts[s] = grouped[s].length;
    });
    res.json({ data: grouped, meta: { counts } });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { cliente, valor_estimado, responsavel, lead_id } = req.body || {};
    if (!cliente) {
      return res.status(400).json({ error: 'invalid_cliente' });
    }
    const valorNum = Number(valor_estimado);
    const valor = Number.isFinite(valorNum) ? valorNum : 0;
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    const leadIdVal = typeof lead_id === 'string' && uuidRegex.test(lead_id) ? lead_id : null;
    const { rows } = await query(
      `INSERT INTO opportunities (lead_id, cliente, valor_estimado, responsavel, status)
       VALUES ($1,$2,$3,$4,'prospeccao')
       RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      [leadIdVal, cliente, valor, responsavel || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const { cliente, valor_estimado, responsavel, status } = req.body || {};
    const fields = [];
    const values = [];
    let idx = 1;
    if (cliente !== undefined) {
      fields.push(`cliente = $${idx++}`);
      values.push(cliente);
    }
    if (valor_estimado !== undefined) {
      const v = Number(valor_estimado);
      fields.push(`valor_estimado = $${idx++}`);
      values.push(Number.isFinite(v) ? v : 0);
    }
    if (responsavel !== undefined) {
      fields.push(`responsavel = $${idx++}`);
      values.push(responsavel || null);
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    values.push(id);
    const { rows } = await query(
      `UPDATE opportunities
          SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${idx}
        RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}
