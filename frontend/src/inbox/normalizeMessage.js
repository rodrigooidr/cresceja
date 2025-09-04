// src/inbox/normalizeMessage.js
export default function normalizeMessage(raw = {}) {
  const direction = raw.direction || (raw.author === 'agent' ? 'outbound' : 'inbound');
  const isMine =
    direction === 'outbound' || raw.author === 'agent' || raw.is_from_me === true;

  return {
    id: String(raw.id ?? raw.message_id ?? Math.random()),
    conversation_id: String(raw.conversation_id),
    text: raw.text || '',
    created_at: raw.created_at || raw.timestamp || new Date().toISOString(),
    direction,
    author: raw.author || (isMine ? 'agent' : 'client'),
    isMine,
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
}
