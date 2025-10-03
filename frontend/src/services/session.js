const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

const ORG_KEYS_LEGACY = ['org_id', 'active_org_id', 'activeOrgId', 'orgId'];

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

function resolveOrgIdFromStorage() {
  const storage = getLocalStorage();
  if (!storage) return null;

  for (const key of ORG_KEYS_LEGACY) {
    try {
      const value = storage.getItem(key);
      if (value) return String(value);
    } catch {}
  }

  try {
    const userOrg = safeParse(storage.getItem('user'))?.org_id ?? null;
    if (userOrg) return String(userOrg);
  } catch {}

  const fromGlobal = globalScope.__TEST_ORG__?.id || globalScope.__TEST_ORG_ID__;
  return fromGlobal ? String(fromGlobal) : null;
}

export function getActiveOrgId() {
  const resolved = resolveOrgIdFromStorage();
  if (resolved) {
    try {
      setActiveOrgId(resolved);
    } catch {}
    return resolved;
  }
  return null;
}

export const getOrgIdFromStorage = getActiveOrgId;
export const getOrgId = getActiveOrgId;

export function setActiveOrgId(id) {
  if (!id) return;
  const storage = getLocalStorage();
  if (!storage) return;
  const value = String(id);
  try {
    ORG_KEYS_LEGACY.forEach((key) => {
      try { storage.removeItem(key); } catch {}
    });
    storage.setItem('orgId', value);
  } catch {}
}

export function setOrgIdInStorage(orgId) {
  if (!orgId) {
    clearOrgIdInStorage();
    return;
  }
  setActiveOrgId(orgId);
}

export function clearOrgIdInStorage() {
  const storage = getLocalStorage();
  if (!storage) return;
  ORG_KEYS_LEGACY.forEach((key) => {
    try { storage.removeItem(key); } catch {}
  });
}

export async function authFetch(input, init = {}) {
  const token = getTokenFromStorage();
  const storedOrgId = getActiveOrgId();

  const isRequestInput = typeof Request !== 'undefined' && input instanceof Request;
  const urlLike = isRequestInput ? input.url : typeof input === 'string' ? input : input?.url || '';
  const orgIdFromUrl = findOrgIdInUrl(urlLike);
  const orgId = orgIdFromUrl || storedOrgId;

  let url = input;
  let options = { ...init };
  let headers;
  let originalRequest = null;

  if (isRequestInput) {
    originalRequest = input.clone();
    url = originalRequest.url;

    headers = new Headers(originalRequest.headers || undefined);
    if (init.headers) {
      const extra = new Headers(init.headers);
      extra.forEach((value, key) => headers.set(key, value));
    }

    const copyKeys = [
      'cache',
      'credentials',
      'integrity',
      'keepalive',
      'mode',
      'redirect',
      'referrer',
      'referrerPolicy',
      'signal',
      'priority',
    ];
    const originalInit = {};
    for (const key of copyKeys) {
      if (Object.prototype.hasOwnProperty.call(init, key)) continue;
      const value = originalRequest[key];
      if (value !== undefined) {
        originalInit[key] = value;
      }
    }

    options = {
      ...originalInit,
      ...init,
      method: init.method ?? original.method,
    };

    if (Object.prototype.hasOwnProperty.call(init, 'body')) {
      options.body = init.body;
    } else {
      options.body = originalRequest.body ?? undefined;
    }
  } else {
    url = input;
    headers = new Headers(init.headers || undefined);
  }

  options.headers = headers;

  if (token) headers.set('Authorization', `Bearer ${token}`);
  else headers.delete('Authorization');

  if (orgId) headers.set('X-Org-Id', orgId);
  else headers.delete('X-Org-Id');

  if (options.credentials === undefined) {
    const originalCredentials = originalRequest?.credentials ?? (isRequestInput ? input.credentials : undefined);
    options.credentials =
      init.credentials ?? originalCredentials ?? 'include';
  }

  return fetch(url, options);
}
