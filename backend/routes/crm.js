import express from 'express';
const router = express.Router();
import pool from '../db.js';
// GET /api/crm/oportunidades?status=novo
router.get('/oportunidades', async (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM public.crm_opportunities';
  let params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar oportunidades:', err);
    res.status(500).json({ error: 'Erro ao buscar oportunidades' });
  }
});

// PUT /api/crm/oportunidades/:id  { status: 'em_andamento' | 'ganho' | 'perdido' | 'novo' }
router.put('/oportunidades/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Status é obrigatório' });

  try {
    await pool.query(
      'UPDATE public.crm_opportunities SET status = $1, updated_at = now() WHERE id = $2',
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status da oportunidade' });
  }
});

export default router;


