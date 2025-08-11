// routes/webhooks_whatsapp.js
// Webhook para receber mensagens do WhatsApp (Meta Cloud API ou Twilio) e marcar agendamentos como confirmados.

import express from 'express';
const router = express.Router();
import pool from '../db.js';
import { PROVIDER } from '../services/whatsapp.js';

// GET verification (Meta WhatsApp Cloud)
// Meta envia: hub.mode, hub.verify_token, hub.challenge
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || 'verifyme';

  if (mode === 'subscribe' && token === verify) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Ajuda: normalizar número para só dígitos
const digits = (n) => (n || '').replace(/\D/g, '');

// Tenta marcar o agendamento mais recente desse contato como confirmado
async function markLatestAppointmentConfirmed(whats) {
  const onlyDigits = digits(whats);
  if (!onlyDigits) return;

  // Garante a coluna de status
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
      CREATE INDEX IF NOT EXISTS idx_appointments_contact ON public.appointments ((regexp_replace(contact_whatsapp, '[^0-9]+', '', 'g')));
    EXCEPTION WHEN others THEN NULL; END $$;
  `);

  const sel = await pool.query(
    `SELECT id FROM public.appointments
     WHERE regexp_replace(contact_whatsapp, '[^0-9]+', '', 'g') = $1
     ORDER BY start_time DESC
     LIMIT 1`,
    [onlyDigits]
  );
  const row = sel.rows[0];
  if (!row) return;

  await pool.query(
    `UPDATE public.appointments SET status = 'confirmed' WHERE id = $1`,
    [row.id]
  );
}

const OK_WORDS = ['ok', 'okay', 'confirmo', 'confirmada', 'confirmado', 'sim', 'certo', 'beleza'];

// POST receiver
router.post('/whatsapp',
  // Twilio costuma enviar application/x-www-form-urlencoded; Meta envia JSON.
  // Deixe o app principal adicionar body parsers (json e urlencoded) ou trate aqui:
  express.json({ type: '*/*' }),
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      if (PROVIDER === 'twilio' && req.body && req.body.From) {
        const from = req.body.From; // formato 'whatsapp:+55119999...'
        const body = (req.body.Body || '').toLowerCase();
        if (OK_WORDS.some(w => body.includes(w))) {
          await markLatestAppointmentConfirmed(from);
        }
        return res.sendStatus(200);
      }

      // Meta WhatsApp Cloud
      const data = req.body;
      if (!data || !data.entry) return res.sendStatus(200); // evita retries
      for (const entry of data.entry) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];
          for (const msg of messages) {
            const from = msg.from; // E.164 sem '+' às vezes
            const text = msg.text?.body?.toLowerCase() || '';
            if (OK_WORDS.some(w => text.includes(w))) {
              await markLatestAppointmentConfirmed(from);
            }
          }
        }
      }
      return res.sendStatus(200);
    } catch (err) {
      console.error('Erro no webhook WhatsApp:', err);
      return res.sendStatus(200); // responde 200 para evitar retry em loop
    }
  }
);

export default router;