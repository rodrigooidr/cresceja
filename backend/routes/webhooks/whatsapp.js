import { Router } from 'express';
import { query } from '#db';
import { decrypt } from '../../services/crypto.js';

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
        const value = ch.value || {};

        // ---- status updates ----
        const statuses = value.statuses || [];
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

        // ---- inbound messages ----
        const messages = value.messages || [];
        for (const m of messages) {
          const phoneNumberId = value.metadata?.phone_number_id;
          const from = m.from;
          if (!phoneNumberId || !from) continue;

          const { rows: chans } = await query(
            "SELECT id, org_id, credentials_json FROM channels WHERE type = 'whatsapp'"
          );
          let orgId = null;
          let channelId = null;
          for (const row of chans) {
            const creds = decrypt(row.credentials_json);
            if (creds?.phone_number_id === phoneNumberId) {
              orgId = row.org_id;
              channelId = row.id;
              break;
            }
          }
          if (!orgId) continue;
          await query('SET LOCAL app.org_id = $1', [orgId]);

          // contato
          const { rows: cRows } = await query(
            'SELECT id FROM contacts WHERE org_id = $1 AND phone_e164 = $2 LIMIT 1',
            [orgId, from]
          );
          let contactId = cRows[0]?.id;
          if (!contactId) {
            const ins = await query(
              'INSERT INTO contacts (org_id, phone_e164) VALUES ($1,$2) RETURNING id',
              [orgId, from]
            );
            contactId = ins.rows[0].id;
          }

          const { rows: convRows } = await query(
            'SELECT id FROM conversations WHERE org_id = $1 AND contact_id = $2 AND channel = $3 LIMIT 1',
            [orgId, contactId, 'whatsapp']
          );
          let convId = convRows[0]?.id;
          if (!convId) {
            const ins = await query(
              'INSERT INTO conversations (org_id, contact_id, channel, status) VALUES ($1,$2,$3,$4) RETURNING id',
              [orgId, contactId, 'whatsapp', 'pending']
            );
            convId = ins.rows[0].id;
          }

          const type = m.type || 'text';
          const text = m.text?.body || null;
          await query(
            `INSERT INTO messages (org_id, conversation_id, "from", provider, provider_message_id, type, text, sender, direction, created_at, updated_at)
             VALUES ($1,$2,'customer','wa',$3,$4,$5,'contact','inbound',now(),now())`,
            [orgId, convId, m.id, type, text]
          );

          await query(
            'UPDATE conversations SET last_message_at = now() WHERE id = $1 AND org_id = $2',
            [convId, orgId]
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
