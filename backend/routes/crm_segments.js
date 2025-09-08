
import { Router } from 'express';
const router = Router();

// RLS: usa req.db (client da transação)
router.get('/segments', async (req, res, next) => {
  const db = req.db;
  try {
    const r = await db.query(`SELECT * FROM segments ORDER BY created_at DESC`);
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post('/segments', async (req, res, next) => {
  const db = req.db;
  const { name, filter } = req.body || {};
  if (!name || !filter) return res.status(400).json({ error: 'missing_fields' });
  try {
    const r = await db.query(
      `INSERT INTO segments (name, filter) VALUES ($1,$2) RETURNING *`,
      [name, filter]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get('/segments/:id/leads', async (req, res, next) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const seg = (await db.query(`SELECT * FROM segments WHERE id=$1`, [id])).rows[0];
    if (!seg) return res.status(404).json({ error: 'not_found' });
    const f = seg.filter || {};
    const min_score = f.min_score || 0;
    const channel = f.channel || null;
    let sql = `SELECT * FROM leads WHERE score >= $1`;
    const params = [min_score];
    if (channel) {
      params.push(channel);
      sql += ` AND source_channel = $${params.length}`;
    }
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

export default router;


