// sessionStorage-based audit log per conversation
const KEY_PREFIX = 'inbox.audit.';
const MAX = 500;

function safeParse(s) {
  try { return JSON.parse(s) || []; } catch { return []; }
}
function keyFor(id) { return `${KEY_PREFIX}${id}`; }

export function load(conversationId) {
  if (!conversationId) return [];
  return safeParse(sessionStorage.getItem(keyFor(conversationId)));
}

export function save(conversationId, entries) {
  try {
    const trimmed = (entries || []).slice(-MAX);
    sessionStorage.setItem(keyFor(conversationId), JSON.stringify(trimmed));
  } catch {}
}

export function append(conversationId, entry) {
  if (!conversationId || !entry) return null;
  const list = load(conversationId);
  const item = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ts: entry.ts || new Date().toISOString(),
    kind: entry.kind,      // 'message' | 'ai' | 'crm' | 'tag' | 'client' | 'media' | 'socket'
    action: entry.action,  // e.g. 'sent' | 'failed' | 'enabled' | 'disabled' | 'accepted' | 'rejected' ...
    meta: entry.meta || {},
  };
  list.push(item);
  save(conversationId, list);
  return item;
}

export function clear(conversationId) {
  try { sessionStorage.removeItem(keyFor(conversationId)); } catch {}
}

export function filter(entries, { query = '', kinds = [] } = {}) {
  let out = Array.isArray(entries) ? entries : [];
  if (Array.isArray(kinds) && kinds.length > 0) {
    out = out.filter(e => kinds.includes(e.kind));
  }
  if (query) {
    const q = query.toLowerCase();
    out = out.filter(e => {
      const blob = `${e.kind} ${e.action} ${JSON.stringify(e.meta || {})}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}

export function exportJson(entriesOrId) {
  if (Array.isArray(entriesOrId)) return JSON.stringify(entriesOrId || [], null, 2);
  return JSON.stringify(load(entriesOrId), null, 2);
}

export function listTypes() {
  return ['message', 'ai', 'crm', 'tag', 'media', 'client', 'socket'];
}

export default { load, save, append, clear, filter, exportJson, listTypes };
