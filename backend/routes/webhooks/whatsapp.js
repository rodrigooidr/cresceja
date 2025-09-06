import { Router } from 'express';
import { query } from '../../config/db.js';

const r = Router();

// verificação do webhook
r.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

r.post('/', async (req, res) => {
  try {
    const entry = req.body?.entry || [];
    for (const e of entry) {
      for (const ch of e.changes || []) {
        const statuses = ch.value?.statuses || [];
        for (const s of statuses) {
          const providerId = s.id;
          const status = mapStatus(s.status);
          if (!providerId || !status) continue;
          await query(
            `UPDATE messages
             SET status = $1, updated_at = now()
             WHERE provider_message_id = $2`,
            [status, providerId]
          );
        }
      }
    }
    res.sendStatus(200);
  } catch (e) {
    res.status(200).end();
  }
});

function mapStatus(x = '') {
  const v = String(x).toLowerCase();
  if (v === 'sent') return 'sent';
  if (v === 'delivered') return 'delivered';
  if (v === 'read') return 'read';
  if (['failed', 'error'].includes(v)) return 'failed';
  return null;
}

export default r;
