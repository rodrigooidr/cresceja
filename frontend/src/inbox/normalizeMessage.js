// src/inbox/normalizeMessage.js
import { apiUrl } from '../utils/apiUrl';

function safeUrl(p) {
  return p ? apiUrl(p) : undefined; // evita retornar apenas a base quando não há caminho
}

export function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const hasAttachments = Array.isArray(raw.attachments) && raw.attachments.length > 0;
  const type =
    raw.type ||
    (raw.audio_url ? 'audio' : hasAttachments ? 'file' : raw.text ? 'text' : 'text');

  const direction =
    raw.direction ??
    (raw.is_outbound ? 'outbound' : raw.is_inbound ? 'inbound' : undefined);

  const from =
    raw.from ||
    (direction === 'outbound'
      ? 'agent'
      : direction === 'inbound'
      ? 'customer'
      : 'customer');

  const attachments = hasAttachments
    ? raw.attachments
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({
          ...a,
          url: safeUrl(a.url),
          thumb_url: safeUrl(a.thumb_url),
        }))
    : [];

  const createdAt =
    raw.created_at ||
    raw.timestamp ||
    raw.date ||
    new Date().toISOString();

  return {
    id: raw.id || raw.message_id || `${Date.now()}-${Math.random()}`,
    type,
    text: raw.text ?? raw.body ?? '',
    from, // 'customer' | 'agent'
    created_at: createdAt,
    attachments,
    audio_url: safeUrl(raw.audio_url),
    transcript_text: raw.transcript_text ?? null,
    group_meta: raw.group_meta,
  };
}

export default normalizeMessage;
