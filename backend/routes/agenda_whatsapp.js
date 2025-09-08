import { Router } from 'express';
import { sendWhatsApp } from '../services/whatsapp.js'; // importar serviço
const router = Router();

// POST /api/agenda
// body: { title, date, channel, contact: { name, whatsapp }, opportunity_id }
router.post('/', async (req, res, next) => {
  const db = req.db;
  const { title, date, channel, contact, opportunity_id } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title e date são obrigatórios' });

  try {
    await db.query(`
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

    await db.query(
      `INSERT INTO public.appointments (title, start_time, channel, contact_name, contact_whatsapp, opportunity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, date, channel || null, contact?.name || null, contact?.whatsapp || null, opportunity_id || null]
    );

    // Enviar confirmação de WhatsApp se houver número
    if (contact?.whatsapp) {
      const quando = new Date(date).toLocaleString('pt-BR', { timeZone: process.env.TZ || 'America/Sao_Paulo' });
      const msg = `Olá${contact?.name ? ', ' + contact.name : ''}! Seu agendamento *${title}* está marcado para ${quando}. ` +
                  `Se precisar reagendar, responda esta mensagem. — Equipe CresceJá`;
      try {
        await sendWhatsApp(contact.whatsapp, msg);
      } catch (whErr) {
        console.error('Falha ao enviar WhatsApp:', whErr.message || whErr);
        // Não falha a criação do agendamento por erro no envio
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    return res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

export default router;


