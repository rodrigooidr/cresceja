// Uses per-request client from withOrg middleware

export async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const allowed = ['novo', 'qualificando'];
    const statusFilter = allowed.includes(req.query.status) ? req.query.status : null;

    const baseParams = [req.orgId];
    let where = 'WHERE org_id = $1';
    if (statusFilter) {
      baseParams.push(statusFilter);
      where += ` AND status = $${baseParams.length}`;
    }

    const totalRes = await req.db.query(`SELECT COUNT(*) FROM leads ${where}`, baseParams);
    const total = Number(totalRes.rows[0]?.count || 0);

    const listParams = [...baseParams, limit, offset];
    const { rows } = await req.db.query(
      `SELECT id, nome, email, telefone, origem, score, tags, responsavel, status, created_at
         FROM leads
         ${where}
        ORDER BY created_at DESC
        LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
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

    const { rows } = await req.db.query(
      `INSERT INTO leads (org_id, nome, email, telefone, origem, status)
       VALUES ($1,$2,$3,$4,$5,'novo')
       RETURNING id, nome, email, telefone, origem, status, score, tags, responsavel, created_at`,
      [req.orgId, nome, email || null, telefone, origemVal]
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
    const { rows } = await req.db.query(
      `UPDATE leads
         SET score = $1,
             tags = $2,
             responsavel = $3,
             status = 'qualificando'
       WHERE id = $4 AND org_id = $5
       RETURNING id, nome, email, telefone, origem, score, tags, responsavel, status, created_at`,
      [scoreNum, tagsArr, responsavel, id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function moverParaOportunidade(req, res, next) {
  try {
    const { id } = req.params;
    const leadRes = await req.db.query(
      `SELECT id, nome FROM leads WHERE id = $1 AND org_id = $2`,
      [id, req.orgId]
    );
    const lead = leadRes.rows[0];
    if (!lead) return res.status(404).json({ error: 'not_found' });

    const oppRes = await req.db.query(
      `INSERT INTO opportunities (org_id, lead_id, cliente, valor_estimado, status)
       VALUES ($1, $2, $3, 0, 'prospeccao')
       RETURNING id, lead_id, cliente, valor_estimado, responsavel, status, created_at, updated_at`,
      [req.orgId, lead.id, lead.nome]
    );

    await req.db.query(`UPDATE leads SET status = 'oportunidade' WHERE id = $1 AND org_id = $2`, [lead.id, req.orgId]);

    res.json({ data: { opportunity: oppRes.rows[0] } });
  } catch (err) {
    next(err);
  }
}
