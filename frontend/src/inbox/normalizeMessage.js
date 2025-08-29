// src/inbox/normalizeMessage.js
import { apiUrl } from '../utils/apiUrl';

function absoluteUrl(p) {
  return p ? apiUrl(p) : undefined;
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
        .map((a, i) => ({
          id: a.id || a.asset_id || a.url || String(i),
          mime: a.mime || a.content_type,
          size: a.size ?? a.filesize,
          filename: a.filename || a.name,
          url: absoluteUrl(a.url),
          thumb_url: absoluteUrl(a.thumb_url),
        }))
    : [];

  const createdAt =
    raw.created_at ||
    raw.timestamp ||
    raw.date ||
    new Date().toISOString();

  return {
    id: raw.id || raw.message_id || raw.temp_id,
    temp_id: raw.temp_id,
    type,
    text: raw.text ?? raw.body ?? '',
    from, // 'customer' | 'agent'
    created_at: createdAt,
    sent_at: raw.sent_at || null,
    delivered_at: raw.delivered_at || null,
    read_at: raw.read_at || null,
    attachments,
    audio_url: absoluteUrl(raw.audio_url),
    transcript_text: raw.transcript_text ?? null,
    group_meta: raw.group_meta,
  };
}

export default normalizeMessage;
