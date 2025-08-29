import inboxApi from '../api/inboxApi';

const CACHE_KEY = 'inbox:quickreplies:v1';
const TTL = 10 * 60 * 1000; // 10 minutes

async function fetchQuickReplies() {
  try {
    const res = await inboxApi.get('/quick-replies', { params: { scope: 'all' } });
    const items = Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return items;
  } catch (err) {
    if (err?.response?.status === 404) {
      try {
        const res2 = await inboxApi.get('/admin/quick-replies');
        const items = Array.isArray(res2?.data?.items)
          ? res2.data.items
          : Array.isArray(res2?.data)
          ? res2.data
          : [];
        return items;
      } catch (_) {
        return [];
      }
    }
    return [];
  }
}

export async function loadQuickReplies() {
  const now = Date.now();
  let cached;
  try {
    cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
  } catch (_) {
    cached = null;
  }
  const hasCache = cached && Array.isArray(cached.items);

  const revalidate = async () => {
    const fresh = await fetchQuickReplies();
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: fresh }));
    return fresh;
  };

  if (!hasCache) {
    const items = await revalidate();
    return { items };
  }

  const expired = now - (cached.ts || 0) > TTL;
  if (expired) {
    revalidate(); // background
  } else {
    revalidate(); // still revalidate to keep fresh
  }
  return { items: cached.items };
}

function updateCache(mutator) {
  let cached;
  try {
    cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
  } catch (_) {
    cached = null;
  }
  const items = Array.isArray(cached?.items) ? cached.items : [];
  const newItems = mutator(items);
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: newItems }));
  return newItems;
}

export async function saveQuickReply({ title, content }) {
  const res = await inboxApi.post('/quick-replies', { title, content, scope: 'personal' });
  const item = res?.data?.data || res?.data?.item || res?.data || { id: Date.now(), title, content, scope: 'personal' };
  const items = updateCache((arr) => [...arr.filter((i) => i.id !== item.id), item]);
  return item;
}

export async function updateQuickReply(id, patch) {
  const res = await inboxApi.put(`/quick-replies/${id}`, patch);
  const item = res?.data?.data || res?.data?.item || res?.data || { id, ...patch };
  updateCache((arr) => arr.map((i) => (String(i.id) === String(id) ? { ...i, ...item } : i)));
  return item;
}

export async function deleteQuickReply(id) {
  await inboxApi.delete(`/quick-replies/${id}`);
  updateCache((arr) => arr.filter((i) => String(i.id) !== String(id)));
}

export function searchQuickReplies(items = [], query = '') {
  if (!Array.isArray(items)) return [];
  const q = (query || '').trim().toLowerCase();
  const arr = items.map((it) => {
    const title = String(it.title || '').toLowerCase();
    const content = String(it.content || '').toLowerCase();
    const tags = Array.isArray(it.tags) ? it.tags.join(' ').toLowerCase() : '';
    let score = 0;
    if (!q) score = 1;
    else {
      if (title.startsWith(q)) score += 100;
      else if (title.includes(q)) score += 50;
      if (content.includes(q)) score += 20;
      if (tags.includes(q)) score += 10;
    }
    return { item: it, score };
  });
  return arr
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.scope !== b.item.scope) return a.item.scope === 'org' ? -1 : 1;
      return String(a.item.title || '').localeCompare(String(b.item.title || ''));
    })
    .map((r) => r.item);
}

export function parseVariables(text = '') {
  const vars = [];
  const re = /\{\{\s*([\w\.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }
  return vars;
}

export function fillDefaultVariables(vars = [], conversation) {
  const res = {};
  const contact = conversation?.contact || {};
  vars.forEach((v) => {
    const k = v.toLowerCase();
    if (contact[k] != null) res[v] = contact[k];
    else if (k === 'nome' && contact.name) res[v] = contact.name;
    else if (k === 'name' && contact.name) res[v] = contact.name;
    else if ((k === 'telefone' || k === 'phone') && contact.phone_e164)
      res[v] = contact.phone_e164;
  });
  return res;
}

export default {
  loadQuickReplies,
  saveQuickReply,
  updateQuickReply,
  deleteQuickReply,
  searchQuickReplies,
  parseVariables,
  fillDefaultVariables,
};

