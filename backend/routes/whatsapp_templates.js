
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res, next) => {
  const db = req.db;
  try {
    const r = await db.query('SELECT * FROM whatsapp_templates ORDER BY updated_at DESC');
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  const db = req.db;
  const { name, category = 'MARKETING', language = 'pt_BR', body } = req.body || {};
  if (!name || !body) return res.status(400).json({ error: 'missing_fields' });
  try {
    const r = await db.query(
      `INSERT INTO whatsapp_templates (name, category, language, body, status)
       VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
      [name, category, language, body]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  const db = req.db;
  const { id } = req.params;
  const { status } = req.body || {};
  try {
    await db.query('UPDATE whatsapp_templates SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;



