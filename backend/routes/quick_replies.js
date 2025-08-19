import express from 'express';
import { query } from '../config/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authRequired);

// Lista respostas rápidas do admin/empresa
router.get('/', async (req, res, next) => {
  try {
    const companyId = req.user?.company_id;
    const { rows } = await query(
      'SELECT id, title, body FROM quick_replies WHERE company_id=$1 ORDER BY updated_at DESC',
      [companyId]
    );
    res.json({ templates: rows });
  } catch (e) {
    next(e);
  }
});

// Cria nova resposta rápida (apenas admin)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const companyId = req.user?.company_id;
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title || !body) return res.status(400).json({ error: 'missing_fields' });
    await query(
      'INSERT INTO quick_replies (company_id, title, body) VALUES ($1,$2,$3)',
      [companyId, title, body]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Atualiza resposta rápida
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const companyId = req.user?.company_id;
    const id = String(req.params.id || '').trim();
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    await query(
      'UPDATE quick_replies SET title=$1, body=$2, updated_at=NOW() WHERE id=$3 AND company_id=$4',
      [title, body, id, companyId]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Remove resposta rápida
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const companyId = req.user?.company_id;
    const id = String(req.params.id || '').trim();
    await query('DELETE FROM quick_replies WHERE id=$1 AND company_id=$2', [id, companyId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
