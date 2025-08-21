// backend/services/social/igfb.js
import { saveInboundMessage } from './shared.js';
import { downloadMediaToAsset } from '../socialHelpers.js';
import { pool } from '../../config/db.js';

export async function sendMessage({ orgId, conversationId, messageId, text }) {
  try {
    const { rows } = await pool.query(`
      SELECT ch.kind AS provider
        FROM conversations c
        JOIN channels ch ON ch.id=c.channel_id AND ch.org_id=c.org_id
       WHERE c.id=$1 AND c.org_id=$2
    `, [conversationId, orgId]);
    const provider = rows[0]?.provider || 'instagram';
    await pool.query(`UPDATE messages SET status='sent', provider=$1 WHERE id=$2 AND org_id=$3`, [provider, messageId, orgId]);
    return { ok: true };
  } catch (e) {
    await pool.query(`UPDATE messages SET status='failed' WHERE id=$1 AND org_id=$2`, [messageId, orgId]);
    throw e;
  }
}

export async function handleWebhook(provider, payload) {
  // parse básico de IG/FB Messaging -> normalizar e chamar saveInboundMessage
  // (implementar mapeamento conforme Graph API)
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const messaging = change.value?.messages || [];
      for (const m of messaging) {
        await saveInboundMessage({
          provider,
          providerMessage: m,
          orgHint: null,
          mediaDownloader: downloadMediaToAsset
        });
      }
    }
  }
}
