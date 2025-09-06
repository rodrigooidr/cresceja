const KEY = 'INBOX_DRAFTS_V1';

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function write(map) {
  try { sessionStorage.setItem(KEY, JSON.stringify(map)); }
  catch {}
}

export function getDraft(conversationId) {
  if (!conversationId) return '';
  const map = read();
  return map[conversationId] || '';
}

export function setDraft(conversationId, text) {
  if (!conversationId) return;
  const map = read();
  if (text && text.trim()) map[conversationId] = text;
  else delete map[conversationId];
  write(map);
}

export function clearDraft(conversationId) {
  if (!conversationId) return;
  const map = read();
  delete map[conversationId];
  write(map);
}
