const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

const ORG_STORAGE_PRIMARY_KEY = 'active_org_id';
const ORG_STORAGE_LEGACY_KEYS = ['activeOrgId', 'orgId', 'org_id'];

function getLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {}
  return null;
}

function syncOrgId(storage, value) {
  if (!storage) return;
  const keys = [ORG_STORAGE_PRIMARY_KEY, ...ORG_STORAGE_LEGACY_KEYS];
  try {
    if (value != null && value !== '') {
      for (const key of keys) storage.setItem(key, value);
    } else {
      for (const key of keys) storage.removeItem(key);
    }
  } catch {}
}

function resolveUrlPath(urlLike) {
  if (!urlLike) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(urlLike, base).pathname || '';
  } catch {
    return typeof urlLike === 'string' ? urlLike : '';
  }
}

export function findOrgIdInUrl(urlLike) {
  const path = resolveUrlPath(typeof urlLike === 'string' ? urlLike : urlLike?.url || '');
  const match = path.match(/\/orgs\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12}|[0-9a-f]{24}|[0-9a-f]{32}|[0-9a-f]{16}|[0-9a-f-]{10,})\b/i);
  return match ? match[1] : null;
}

function safeParse(value) {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
}

export function getTokenFromStorage() {
  const storage = getLocalStorage();
  if (!storage) return null;

  const direct = storage.getItem('token') || storage.getItem('authToken');
  if (direct) return String(direct);

  const auth = safeParse(storage.getItem('auth'));
  if (auth?.token) return String(auth.token);

  const fromGlobal = globalScope.__TEST_AUTH__?.token || globalScope.__TEST_TOKEN__;
  return fromGlobal != null ? String(fromGlobal) : null;
}

export const getToken = getTokenFromStorage;

export function getOrgIdFromStorage() {
  const storage = getLocalStorage();
  if (!storage) return null;

  const keys = [ORG_STORAGE_PRIMARY_KEY, ...ORG_STORAGE_LEGACY_KEYS];
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value != null && value !== '') {
      const str = String(value);
      syncOrgId(storage, str);
      return str;
    }
  }

  const userOrg = safeParse(storage.getItem('user'))?.org_id ?? null;
  if (userOrg != null && userOrg !== '') {
    const str = String(userOrg);
    syncOrgId(storage, str);
    return str;
  }

  const fromGlobal = globalScope.__TEST_ORG__?.id || globalScope.__TEST_ORG_ID__;
  if (fromGlobal != null && fromGlobal !== '') {
    const str = String(fromGlobal);
    syncOrgId(storage, str);
    return str;
  }

  return null;
}

export const getOrgId = getOrgIdFromStorage;

export function setOrgIdInStorage(orgId) {
  const storage = getLocalStorage();
  if (!storage) return;
  const value = orgId != null && orgId !== '' ? String(orgId) : null;
  syncOrgId(storage, value);
}

export function clearOrgIdInStorage() {
  setOrgIdInStorage(null);
}

export async function authFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getTokenFromStorage();
  const storedOrgId = getOrgIdFromStorage();
  const urlLike = typeof input === 'string' ? input : input?.url || '';
  const orgIdFromUrl = findOrgIdInUrl(urlLike);
  const orgId = orgIdFromUrl || storedOrgId;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (orgId) {
    headers.set('X-Org-Id', orgId);
  }

  return fetch(input, { ...init, headers });
}
