const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

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

function safeParse(value) {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
}

export function getToken() {
  const storage = getLocalStorage();
  if (!storage) return null;

  const direct = storage.getItem('token') || storage.getItem('authToken');
  if (direct) return String(direct);

  const auth = safeParse(storage.getItem('auth'));
  if (auth?.token) return String(auth.token);

  const fromGlobal = globalScope.__TEST_AUTH__?.token || globalScope.__TEST_TOKEN__;
  return fromGlobal != null ? String(fromGlobal) : null;
}

export function getOrgId() {
  const storage = getLocalStorage();
  if (!storage) return null;

  const orgId =
    storage.getItem('orgId') ||
    storage.getItem('activeOrgId') ||
    storage.getItem('active_org_id') ||
    safeParse(storage.getItem('user'))?.org_id ||
    null;

  if (orgId) return String(orgId);

  const fromGlobal = globalScope.__TEST_ORG__?.id || globalScope.__TEST_ORG_ID__;
  return fromGlobal != null ? String(fromGlobal) : null;
}

export async function authFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  const orgId = getOrgId();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (orgId) {
    headers.set('X-Org-Id', orgId);
  }

  return fetch(input, { ...init, headers });
}
