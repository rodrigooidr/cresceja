import { query } from '../config/db.js';

export async function listLeads(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { rows } = await query(
      `SELECT id, nome, email, telefone, origem, status,
              score, tags, responsavel, created_at
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

export async function qualifyLead(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const { score, tags, responsavel } = req.body || {};
    const { rows } = await query(
      `UPDATE leads
          SET score = $1,
              tags = $2,
              responsavel = $3,
              status = 'qualificando'
        WHERE id = $4
      RETURNING id, nome, email, telefone, origem, status,
                score, tags, responsavel, created_at`,
      [
        typeof score === 'number' ? score : 0,
        Array.isArray(tags) ? tags : [],
        responsavel || null,
        id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function moveToOpportunity(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const leadRes = await query(
      `SELECT id, nome FROM leads WHERE id = $1`,
      [id]
    );
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    const lead = leadRes.rows[0];

    const oppRes = await query(
      `INSERT INTO opportunities (lead_id, cliente)
       VALUES ($1,$2)
       RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      [lead.id, lead.nome]
    );

    await query(
      `UPDATE leads SET status = 'oportunidade' WHERE id = $1`,
      [id]
    );

    res.status(201).json(oppRes.rows[0]);
  } catch (err) {
    next(err);
  }
}
