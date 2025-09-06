// src/inbox/normalizeMessage.js
import { normalizeDirection, isMineMessage } from './message.helpers';

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
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map((a) => ({
        id: a.id || a.asset_id || a.url,
        url: a.url,
        thumb_url: a.thumb_url || null,
        filename: a.filename || a.name,
        mime: a.mime || a.mime_type || a.content_type,
      }))
    : [];

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
