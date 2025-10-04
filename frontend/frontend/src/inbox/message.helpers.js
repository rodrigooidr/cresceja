// src/inbox/message.helpers.js

/** @returns {'in'|'out'|null} */
export function normalizeDirection(d) {
  const x = String(d ?? '').toLowerCase();
  if (!x) return null;

  if (['out', 'outbound', 'outgoing', 'sent', 'from_me'].includes(x)) return 'out';
  if (['in', 'inbound', 'incoming', 'received', 'to_me'].includes(x)) return 'in';

  // nunca propague valores não padronizados
  return null;
}

export function isMineMessage(msg = {}) {
  // 1) sinais explícitos do backend
  const s = String(msg?.sender ?? '').toLowerCase();
  if (['agent', 'operator', 'me'].includes(s)) return true;
  if (['contact', 'customer', 'client', 'bot'].includes(s)) return false;

  if (typeof msg?.from_me === 'boolean') return !!msg.from_me; // WhatsApp/Telegram-like
  if (String(msg?.author ?? '').toLowerCase() === 'agent') return true;

  // 2) fallback por direção padronizada
  const dir = normalizeDirection(msg?.direction);
  if (dir != null) return dir === 'out';

  // 3) último recurso
  return false;
}

// Opcional: default para compatibilidade com `import helpers from '...';`
const helpers = { normalizeDirection, isMineMessage };
export default helpers;
