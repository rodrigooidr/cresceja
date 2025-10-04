// src/inbox/normalizeMessage.js
import { normalizeDirection, isMineMessage } from './message.helpers';
import { apiUrl as inboxApiUrl } from '@/api';

const normalizedApiUrl = typeof inboxApiUrl === 'string' ? inboxApiUrl : String(inboxApiUrl || '');
const API_BASE = normalizedApiUrl.replace(/\/$/, '');

function mediaEndpoint(messageId, index) {
  const encodedId = encodeURIComponent(String(messageId || ''));
  const path = `/media/${encodedId}/${index}`;
  if (API_BASE) return `${API_BASE}${path}`;
  return `/api${path}`;
}

function deduceSender(raw, dir /* 'in' | 'out' | null */) {
  // 1) explícito
  const s = String(raw?.sender ?? '').toLowerCase();
  if (s) return s;

  // 2) campos comuns
  const from = String(raw?.from ?? '').toLowerCase();
  if (from === 'agent' || from === 'operator' || from === 'me') return 'agent';
  if (from === 'contact' || from === 'customer' || from === 'client' || from === 'bot') return 'contact';

  // 3) bandeiras
  if (typeof raw?.from_me === 'boolean') return raw.from_me ? 'agent' : 'contact';
  if (String(raw?.author ?? '').toLowerCase() === 'agent') return 'agent';

  // 4) direção já normalizada pelo helper
  if (dir === 'out') return 'agent';
  if (dir === 'in') return 'contact';

  // 5) fallback
  return 'contact';
}

export default function normalizeMessage(raw = {}) {
  // aceita diferentes chaves para o texto
  const text =
    raw.text ??
    raw.body ??
    raw.message ??
    raw.content ??
    '';

  // aceita diversas variações de direction; helper devolve 'in' | 'out' | null
  const dirInput =
    raw.direction ??
    (raw.from_me ? 'out' : undefined) ??
    (String(raw.sender ?? '').toLowerCase() === 'agent' ? 'out' : undefined) ??
    (String(raw.from ?? '').toLowerCase() === 'agent' ? 'out' : undefined);

  const normalizedDir = normalizeDirection(dirInput);

  // primeiro calcula um sender consistente
  const sender = deduceSender(raw, normalizedDir);
  // se a direção não veio ou ficou null, derive a partir do sender
  const direction = normalizedDir ?? (sender === 'agent' ? 'out' : 'in');

  // padroniza anexos
  const rawAttachments = Array.isArray(raw.attachments)
    ? raw.attachments
    : Array.isArray(raw.message_attachments)
      ? raw.message_attachments
      : Array.isArray(raw.attachments_json)
        ? raw.attachments_json.map((a, index) => ({ ...a, _index: index }))
        : [];

  const attachments = rawAttachments.map((a, idx) => {
    const index = typeof a._index === 'number' ? a._index : idx;
    const storageKey = a.storage_key ?? a.path_or_key ?? a.pathOrKey ?? null;
    const pathOrKey = a.pathOrKey ?? a.path_or_key ?? storageKey ?? null;
    const fileName = a.fileName ?? a.file_name ?? a.filename ?? a.name ?? a.title ?? null;
    const mimeType = a.mime ?? a.mime_type ?? a.content_type ?? null;
    const sizeBytes = a.sizeBytes ?? a.size_bytes ?? a.size ?? null;
    const width = a.width ?? null;
    const height = a.height ?? null;
    const durationMs = a.durationMs ?? a.duration_ms ?? null;
    const storageProvider = a.storageProvider ?? a.storage_provider ?? null;
    const thumbnailKey = a.thumbnailKey ?? a.thumbnail_key ?? null;
    const posterKey = a.posterKey ?? a.poster_key ?? null;

    let url = a.url || a.remote_url || null;
    if (!url && pathOrKey && raw.id) {
      url = mediaEndpoint(raw.id, index);
    }
    const thumbUrl = a.thumbUrl || a.thumb_url || a.preview_url || null;

    return {
      id: a.id || a.asset_id || a.attachment_id || `${raw.id || 'att'}_${index}`,
      url,
      thumb_url: thumbUrl,
      thumbUrl,
      filename: fileName,
      fileName,
      mime: mimeType,
      sizeBytes,
      width,
      height,
      durationMs,
      storageProvider,
      pathOrKey,
      storage_key: storageKey,
      storageKey,
      thumbnailKey,
      posterKey,
      remote_url: a.remote_url || a.url || null,
    };
  });

  const msg = {
    id: String(raw.id ?? raw.message_id ?? `${Date.now()}-${Math.random()}`),
    conversation_id: String(raw.conversation_id ?? raw.conv_id ?? raw.conversationId ?? ''),
    text,
    created_at: raw.created_at || raw.timestamp || new Date().toISOString(),
    type: raw.type || (attachments.length ? 'file' : 'text'),
    direction,              // 'in' | 'out'
    sender,                 // 'agent' | 'contact'
    from: raw.from ?? sender, // espelho para componentes que usam `from`
    attachments,
  };

  return {
    ...msg,
    isMine: isMineMessage(msg),                 // usa seus helpers
    author: raw.author || (sender === 'agent' ? 'agent' : 'client'),
  };
}
