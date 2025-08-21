// backend/services/social/waCloud.js
import { pool } from '../../config/db.js';
import { saveInboundMessage } from './shared.js';
import { downloadMediaToAsset, upsertContactAndConversation } from '../socialHelpers.js';
import fetch from 'node-fetch';

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function sendMessage({ orgId, conversationId, messageId, text, attachments }) {
  // carregar channel (phone_number_id, token) pela conversationId/orgId
  const { rows } = await pool.query(`
    SELECT ch.settings->>'phone_number_id' AS phone_id, ch.secrets->>'token' AS token, ct.external_id
    FROM conversations c
    JOIN channels ch ON ch.id=c.channel_id AND ch.org_id=c.org_id
    JOIN contacts ct ON ct.id=c.contact_id AND ct.org_id=c.org_id
    WHERE c.id=$1 AND c.org_id=$2
  `, [conversationId, orgId]);
  if (!rows[0]) {
    await pool.query(`UPDATE messages SET status='failed' WHERE id=$1 AND org_id=$2`, [messageId, orgId]);
    throw new Error('wa_channel_not_found');
  }

  const { phone_id, token, external_id } = rows[0];
  const url = `${GRAPH}/${phone_id}/messages`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const body = { messaging_product: 'whatsapp', to: external_id, type: 'text', text: { body: text } };
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await resp.json().catch(() => ({}));
  if (resp.ok) {
    const providerId = json.messages?.[0]?.id || null;
    await pool.query(
      `UPDATE messages SET status='sent', provider='whatsapp', provider_message_id=$1 WHERE id=$2 AND org_id=$3`,
      [providerId, messageId, orgId]
    );
    return json;
  }

  await pool.query(`UPDATE messages SET status='failed' WHERE id=$1 AND org_id=$2`, [messageId, orgId]);
  throw new Error('wa_send_failed');
}

export async function handleWebhook(payload) {
  // percorrer entries/changes do WhatsApp Cloud
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value;
      const orgHint = v?.metadata?.display_phone_number; // opcional: mapear org por channel
      for (const m of v.messages || []) {
        await saveInboundMessage({
          provider: 'wa_cloud',
          providerMessage: m,
          orgHint,
          mediaDownloader: downloadMediaToAsset
        });
      }
      // statuses (delivered/read) podem atualizar messages.status aqui
    }
  }
}
