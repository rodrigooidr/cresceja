// src/inbox/message.helpers.js
export function normalizeDirection(d) {
  if (!d) return d;
  const x = String(d).toLowerCase();
  if (x === 'outbound' || x === 'out') return 'out';
  if (x === 'inbound'  || x === 'in')  return 'in';
  return x;
}

export function isMineMessage(msg) {
  const dir = normalizeDirection(msg.direction);
  if (msg.sender === 'agent') return true;     // banco ajuda
  if (msg.sender === 'contact') return false;
  return dir === 'out'; // fallback
}
