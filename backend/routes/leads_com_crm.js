import express from 'express';
const router = express.Router();
import pool from '../db.js';
router.post('/', async (req, res) => {
  const { name, email, whatsapp } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
  }

  try {
    const leadResult = await pool.query(
      'INSERT INTO public.leads (name, email, whatsapp) VALUES ($1, $2, $3) RETURNING id',
      [name, email, whatsapp]
    );
    const leadId = leadResult.rows[0].id;

    await pool.query(
      'INSERT INTO public.crm_opportunities (lead_id, name, email, whatsapp) VALUES ($1, $2, $3, $4)',
      [leadId, name, email, whatsapp]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar lead/crm:', err);
    res.status(500).json({ error: 'Erro interno ao salvar lead' });
  }
});

export default router;