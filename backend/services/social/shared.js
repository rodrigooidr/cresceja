// backend/services/social/shared.js
import { pool } from '../../config/db.js';
import { io } from '../realtime.js';
import { upsertContactAndConversation, persistInboundMessage } from '../socialHelpers.js';
import { autoReplyIfEnabled } from '../ai/autoResponder.js';

export async function saveInboundMessage({ provider, providerMessage, orgHint, mediaDownloader }) {
  // 1) deduzir org/channel/contact a partir do providerMessage (helper upsertContactAndConversation)
  const { orgId, conversationId, contactId } = await upsertContactAndConversation(provider, providerMessage, orgHint);

  // 2) baixar mídias/avatars quando houver (mediaDownloader) e persistir message + attachments
  const { messageId, textNormalized } = await persistInboundMessage({
    orgId, conversationId, provider, providerMessage, mediaDownloader
  });

  // 3) aumentar unread_count + atualizar last_message_at
  await pool.query(`
    UPDATE conversations
       SET unread_count = unread_count + 1,
           last_message_at = NOW()
     WHERE id=$1 AND org_id=$2
  `, [conversationId, orgId]);

  // 4) realtime para a org e para a conversa
  io.to(`org:${orgId}`).emit('message:new', { conversationId, messageId });
  io.to(`conv:${orgId}:${conversationId}`).emit('message:new', { conversationId, messageId });

  // 5) IA: se habilitada -> gerar resposta / ou detectar handoff
  await autoReplyIfEnabled({ orgId, conversationId, contactId, text: textNormalized });
}
