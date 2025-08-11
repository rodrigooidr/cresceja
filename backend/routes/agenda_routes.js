import express from 'express';
const router = express.Router();
import pool from '../db.js';
// POST /api/agenda
// body: { title, date, channel, contact: { name, whatsapp }, opportunity_id }
router.post('/', async (req, res) => {
  const { title, date, channel, contact, opportunity_id } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title e date são obrigatórios' });

  try {
    // Garante tabela appointments básica (id, title, start_time, channel, contact_name, contact_whatsapp, opportunity_id)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        channel TEXT,
        contact_name TEXT,
        contact_whatsapp TEXT,
        opportunity_id UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await pool.query(
      `INSERT INTO public.appointments (title, start_time, channel, contact_name, contact_whatsapp, opportunity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, date, channel || null, contact?.name || null, contact?.whatsapp || null, opportunity_id || null]
    );

    // (Opcional) Enviar confirmação via WhatsApp — stub/ponto de integração
    // Exemplo: integrar com sua função/metas API/Twilio aqui.
    // await enviarWhatsapp(contact?.whatsapp, `Confirmação: \${title} em \${new Date(date).toLocaleString()}`);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    return res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

export default router;