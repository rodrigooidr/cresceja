// src/inbox/message.helpers.js
export function normalizeDirection(d) {
  if (!d) return d;
  const x = String(d).toLowerCase();
  if (x === 'outbound' || x === 'out') return 'out';
  if (x === 'inbound'  || x === 'in')  return 'in';
  return x;
}

export function isMineMessage(msg) {
  // prioriza sender quando existir
  if (msg?.sender === 'agent')   return true;
  if (msg?.sender === 'contact') return false;
  // fallback por direction
  return normalizeDirection(msg?.direction) === 'out';
}
