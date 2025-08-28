const KEY = 'inbox.snippets.v1';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function loadSnippets() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    raw = null;
  }
  if (!raw || raw.v !== 1 || !Array.isArray(raw.items)) return { v: 1, items: [] };
  const items = raw.items.map((it) => ({
    id: it.id || uuid(),
    title: it.title || '',
    content: it.content || '',
    shortcut: it.shortcut || '',
    updated_at: it.updated_at || new Date().toISOString(),
  }));
  return { v: 1, items };
}

export function saveSnippets(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function upsertSnippet(state, snippet) {
  const id = snippet.id || uuid();
  const now = new Date().toISOString();
  let shortcut = (snippet.shortcut || '').trim();
  let items = state.items.filter((it) => it.id !== id && it.title !== snippet.title);
  if (shortcut) {
    const base = shortcut;
    let n = 1;
    while (items.some((it) => it.shortcut === shortcut)) {
      n += 1;
      shortcut = `${base}-${n}`;
    }
  }
  const item = {
    id,
    title: snippet.title,
    content: snippet.content,
    shortcut,
    updated_at: now,
  };
  items = [...items, item];
  return { v: 1, items };
}

export function deleteSnippet(state, id) {
  return { v: 1, items: state.items.filter((it) => it.id !== id) };
}

export function searchSnippets(items, query) {
  const q = (query || '').toLowerCase();
  return (items || []).filter((it) => {
    const t = (it.title || '').toLowerCase();
    const s = (it.shortcut || '').toLowerCase();
    return !q || t.includes(q) || s.includes(q);
  });
}

export function applyVariables(content, contact = {}) {
  const first_name = (contact.name || '').split(/\s+/)[0] || '';
  const full_name = contact.name || '';
  const phone = contact.phone_e164 || '';
  const email = contact.email || '';
  const map = { first_name, full_name, phone, email };
  return String(content || '').replace(/\{(first_name|full_name|phone|email)\}/g, (m, k) => map[k] || m);
}

export function importSnippets(state, jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('invalid json');
  }
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) throw new Error('invalid structure');
  let imported = 0, updated = 0, ignored = 0;
  let curr = state;
  parsed.items.forEach((it) => {
    if (!it.title || !it.content) { ignored += 1; return; }
    const existing = curr.items.find((s) => s.title === it.title);
    if (existing) {
      const existingAt = new Date(existing.updated_at || 0).getTime();
      const newAt = new Date(it.updated_at || 0).getTime();
      if (newAt > existingAt) {
        curr = upsertSnippet(curr, { ...it, id: existing.id });
        updated += 1;
      } else {
        ignored += 1;
      }
    } else {
      curr = upsertSnippet(curr, it);
      imported += 1;
    }
  });
  return { imported, updated, ignored, state: curr };
}

export function exportSnippets(state) {
  return JSON.stringify(state);
}

export default {
  loadSnippets,
  saveSnippets,
  upsertSnippet,
  deleteSnippet,
  searchSnippets,
  applyVariables,
  importSnippets,
  exportSnippets,
};
