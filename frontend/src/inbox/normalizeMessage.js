// src/inbox/normalizeMessage.js
import { normalizeDirection, isMineMessage } from './message.helpers';

export default function normalizeMessage(raw = {}) {
  const direction = normalizeDirection(
    raw.direction || (raw.sender === 'agent' ? 'outbound' : 'inbound')
  );
  const base = {
    id: String(raw.id ?? raw.message_id ?? Math.random()),
    conversation_id: String(raw.conversation_id),
    text: raw.text || '',
    created_at: raw.created_at || raw.timestamp || new Date().toISOString(),
    direction,
    sender: raw.sender || (direction === 'out' ? 'agent' : 'contact'),
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map((a) => ({
          id: a.id || a.asset_id || a.url,
          url: a.url,
          thumb_url: a.thumb_url || null,
          filename: a.filename || a.name,
          mime: a.mime || a.mime_type || a.content_type,
        }))
      : [],
  };
  return {
    ...base,
    isMine: isMineMessage(base),
    author: raw.author || (base.sender === 'agent' ? 'agent' : 'client'),
  };
}
