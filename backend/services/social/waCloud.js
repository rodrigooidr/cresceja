// backend/services/social/waCloud.js
import { pool } from '../../config/db.js';
import { saveInboundMessage } from './shared.js';

// Use Node 18+ global fetch (no node-fetch import needed)
const GRAPH = 'https://graph.facebook.com/v20.0';

export async function sendMessage({ orgId, conversationId, text, attachments = [] }) {
  const q = `
    SELECT ch.config->>'phone_number_id' AS phone_id,
           ch.secrets->>'token' AS token,
           ct.phone AS to_phone
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id AND ch.org_id = c.org_id
    JOIN contacts   ct ON ct.id = c.contact_id AND ct.org_id = c.org_id
    WHERE c.id = $1 AND c.org_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [conversationId, orgId]);
  if (!rows[0]) throw new Error('wa_channel_or_contact_not_found');
  const { phone_id, token, to_phone } = rows[0];
  if (!to_phone) throw new Error('contact_phone_missing');

  const url = `${GRAPH}/${phone_id}/messages`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = {
    messaging_product: 'whatsapp',
    to: to_phone,
    type: 'text',
    text: { body: text || '' }
  };

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error('wa_send_failed:' + JSON.stringify(json));
  return json;
}

export async function handleWebhook(payload) {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value || {};
      const orgHint = v?.metadata?.phone_number_id || v?.metadata?.display_phone_number || null;

      for (const m of v?.messages ?? []) {
        await saveInboundMessage({
          provider: 'whatsapp_cloud',
          providerMessage: m,
          orgHint
        });
      }
      // TODO: map v.statuses for delivery/read updates
    }
  }
}
