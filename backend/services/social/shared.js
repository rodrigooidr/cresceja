// backend/services/social/shared.js
import { query as rootQuery } from '../../config/db.js';
import { io } from '../realtime.js';
import { upsertContactAndConversation, persistInboundMessage } from '../socialHelpers.js';
import { autoReplyIfEnabled } from '../ai/autoResponder.js';

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function saveInboundMessage({ db, provider, providerMessage, orgHint, mediaDownloader }) {
  // 1) deduzir org/channel/contact a partir do providerMessage (helper upsertContactAndConversation)
  const { orgId, conversationId, contactId } = await upsertContactAndConversation(db, provider, providerMessage, orgHint);

  // 2) baixar mídias/avatars quando houver (mediaDownloader) e persistir message + attachments
  const { messageId, textNormalized } = await persistInboundMessage({
    db, orgId, conversationId, provider, providerMessage, mediaDownloader
  });

  // 3) aumentar unread_count + atualizar last_message_at
  await q(db)(`
    UPDATE conversations
       SET unread_count = unread_count + 1,
           last_message_at = NOW()
     WHERE id=$1 AND org_id=$2
  `, [conversationId, orgId]);

  // 4) realtime para a org e para a conversa
  io.to(`org:${orgId}`).emit('message:new', { conversationId, messageId });
  io.to(`conv:${orgId}:${conversationId}`).emit('message:new', { conversationId, messageId });

  // 5) IA: se habilitada -> gerar resposta / ou detectar handoff
  await autoReplyIfEnabled({ db, orgId, conversationId, contactId, text: textNormalized });
}
