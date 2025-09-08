// backend/routes/approvalRoutes.js
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Protege todas as rotas abaixo com JWT
router.use(authRequired);

// Lista aprovações pendentes (se a tabela existir)
router.get('/pending', async (req, res) => {
  const db = req.db;
  try {
    const { rows } = await db.query(`
      SELECT id, post_id, reviewer_id, status, created_at
        FROM public.post_approvals
       WHERE COALESCE(status,'pending') IN ('pending','aguardando','em_analise')
       ORDER BY created_at DESC
       LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('[approval] GET /pending error:', err.message);
    // Caso a tabela ainda não exista, responda com vazio para não derrubar o servidor
    res.json([]);
  }
});

// Aprovar
router.post('/:id/approve', async (req, res) => {
  const db = req.db;
  try {
    const id = req.params.id;
    await db.query(
      `UPDATE public.post_approvals
          SET status='approved',
              approved_by=$1,
              approved_at=now()
        WHERE id=$2`,
      [req.user?.id ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[approval] POST /:id/approve error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Rejeitar
router.post('/:id/reject', async (req, res) => {
  const db = req.db;
  try {
    const id = req.params.id;
    const reason = req.body?.reason ?? null;
    await db.query(
      `UPDATE public.post_approvals
          SET status='rejected',
              rejected_by=$1,
              rejected_at=now(),
              reject_reason=$3
        WHERE id=$2`,
      [req.user?.id ?? null, id, reason]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[approval] POST /:id/reject error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
