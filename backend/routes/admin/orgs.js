import { Router } from 'express';

const router = Router();

// GET /api/admin/orgs - list organizations
router.get('/orgs', async (req, res) => {
  try {
    const { q = '', page = 1, pageSize = 20 } = req.query;
    const limit = Math.max(1, Math.min(Number(pageSize) || 20, 100));
    const offset = Math.max(0, (Number(page) - 1) * limit);

    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE o.name ILIKE $1`;
    }
    const listSql = `SELECT o.id, o.name, o.slug, o.status, o.plan, o.seats, o.mrr, o.created_at, o.last_activity_at
      FROM orgs o ${where} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int AS total FROM orgs o ${where}`;
    params.push(limit, offset);

    const [itemsRes, countRes] = await Promise.all([
      req.db.query(listSql, params),
      req.db.query(countSql, params.slice(0, params.length - 2)),
    ]);

    res.json({ items: itemsRes.rows, total: countRes.rows[0]?.total || 0, page: Number(page) || 1, pageSize: limit });
  } catch (err) {
    console.error('GET /api/admin/orgs', err);
    res.status(500).json({ error: 'orgs_list_failed' });
  }
});

// GET /api/admin/orgs/:id - basic detail
router.get('/orgs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await req.db.query(
      `SELECT id, name, slug, status, plan, seats, mrr, created_at, last_activity_at FROM orgs WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/admin/orgs/:id', err);
    res.status(500).json({ error: 'org_detail_failed' });
  }
});

// POST /api/admin/orgs/:id/impersonate - validate org existence
router.post('/orgs/:id/impersonate', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await req.db.query(`SELECT 1 FROM orgs WHERE id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/orgs/:id/impersonate', err);
    res.status(500).json({ error: 'impersonate_failed' });
  }
});

export default router;
