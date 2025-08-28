const TTL = 10 * 60 * 1000; // 10 minutes
const PREFIX = 'inbox:conv:';
const SUFFIX = ':v1';
const LRU_KEY = 'inbox:conv:lru:v1';

function key(id) {
  return `${PREFIX}${id}${SUFFIX}`;
}

function loadLRU() {
  try {
    const raw = sessionStorage.getItem(LRU_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLRU(arr) {
  try {
    sessionStorage.setItem(LRU_KEY, JSON.stringify(arr));
  } catch (_) {}
}

function removeFromLRU(id) {
  const lru = loadLRU();
  const idx = lru.indexOf(String(id));
  if (idx >= 0) {
    lru.splice(idx, 1);
    saveLRU(lru);
  }
}

export function touchConvCache(id) {
  const lru = loadLRU();
  const sid = String(id);
  const idx = lru.indexOf(sid);
  if (idx >= 0) lru.splice(idx, 1);
  lru.push(sid);
  saveLRU(lru);
}

export function readConvCache(id) {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const age = Date.now() - (obj.updatedAt || 0);
    if (age > TTL) {
      sessionStorage.removeItem(key(id));
      removeFromLRU(id);
      return null;
    }
    touchConvCache(id);
    return { items: obj.items || [], updatedAt: obj.updatedAt, etag: obj.etag };
  } catch (_) {
    return null;
  }
}

export function writeConvCache(id, payload) {
  try {
    sessionStorage.setItem(key(id), JSON.stringify(payload));
  } catch (_) {}
  touchConvCache(id);
}

export function mergeMessages(prevItems = [], newItems = []) {
  const map = new Map();
  prevItems.forEach((m) => map.set(m.id, m));
  newItems.forEach((m) => {
    if (m && typeof m === 'object') {
      if (m.temp_id && map.has(m.temp_id)) map.delete(m.temp_id);
      map.set(m.id, m);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function pruneLRU(max = 20) {
  const lru = loadLRU();
  while (lru.length > max) {
    const id = lru.shift();
    sessionStorage.removeItem(key(id));
  }
  saveLRU(lru);
}

export default {
  readConvCache,
  writeConvCache,
  touchConvCache,
  mergeMessages,
  pruneLRU,
};
