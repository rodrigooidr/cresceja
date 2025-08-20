import { query } from '../config/db.js';

export async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const allowed = ['novo', 'qualificando'];
    const statusFilter = allowed.includes(req.query.status) ? req.query.status : null;

    let where = '';
    const countParams = [];
    if (statusFilter) {
      where = 'WHERE status = $1';
      countParams.push(statusFilter);
    }

    const totalRes = await query(`SELECT COUNT(*) FROM leads ${where}`, countParams);
    const total = Number(totalRes.rows[0]?.count || 0);

    const listParams = [limit, offset];
    if (statusFilter) listParams.push(statusFilter);
    const statusClause = statusFilter ? 'WHERE status = $3' : '';

    const { rows } = await query(
      `SELECT id, nome, email, telefone, origem, score, tags, responsavel, status, created_at
         FROM leads
         ${statusClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      listParams
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
       RETURNING id, nome, email, telefone, origem, status, score, tags, responsavel, created_at`,
      [nome, email || null, telefone, origemVal]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function qualificar(req, res, next) {
  try {
    const { score = 0, tags = [], responsavel } = req.body || {};
    const scoreNum = Number(score);
    if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ error: 'invalid_score' });
    }
    if (!responsavel) {
      return res.status(400).json({ error: 'invalid_responsavel' });
    }
    const tagsArr = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE leads
         SET score = $1,
             tags = $2,
             responsavel = $3,
             status = 'qualificando'
       WHERE id = $4
       RETURNING id, nome, email, telefone, origem, score, tags, responsavel, status, created_at`,
      [scoreNum, tagsArr, responsavel, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function moverParaOportunidadeStub(_req, res) {
  res.json({ ok: true, message: 'stub: criação de oportunidade na Sprint 3' });
}
