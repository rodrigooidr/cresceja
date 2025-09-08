import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

// Lista respostas rápidas do admin/empresa
router.get('/', async (req, res, next) => {
  const db = req.db;
  try {
    const { rows } = await db.query(
      'SELECT id, title, body FROM quick_replies ORDER BY updated_at DESC'
    );
    res.json({ templates: rows });
  } catch (e) {
    next(e);
  }
});

// Cria nova resposta rápida (apenas admin)
router.post('/', requireRole('admin'), async (req, res, next) => {
  const db = req.db;
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title || !body) return res.status(400).json({ error: 'missing_fields' });
    await db.query(
      `INSERT INTO quick_replies (company_id, title, body) VALUES (current_setting('app.org_id')::uuid, $1, $2)`,
      [title, body]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Atualiza resposta rápida
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const db = req.db;
  try {
    const id = String(req.params.id || '').trim();
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    await db.query(
      'UPDATE quick_replies SET title=$1, body=$2, updated_at=NOW() WHERE id=$3',
      [title, body, id]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Remove resposta rápida
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  const db = req.db;
  try {
    const id = String(req.params.id || '').trim();
    await db.query('DELETE FROM quick_replies WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
