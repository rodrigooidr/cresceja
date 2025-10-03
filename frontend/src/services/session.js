import { computeOrgId } from '../api/orgHeader.js';

const globalScope =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : {};

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const direct =
        window.localStorage.getItem('token') ||
        window.localStorage.getItem('authToken');
      if (direct) return String(direct);

      const saved = parseJSON(window.localStorage.getItem('auth'));
      if (saved?.token) return String(saved.token);
    }
  } catch {}

  const fromGlobal =
    globalScope.__TEST_AUTH__?.token ||
    globalScope.__TEST_TOKEN__ ||
    null;
  return fromGlobal != null ? String(fromGlobal) : null;
}

export function getOrgId() {
  const computed = computeOrgId();
  if (computed != null && computed !== '') return String(computed);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored =
        window.localStorage.getItem('activeOrgId') ??
        window.localStorage.getItem('active_org_id');
      if (stored) return String(stored);
    }
  } catch {}

  const fromGlobal =
    globalScope.__TEST_ORG__?.id ||
    globalScope.__TEST_ORG_ID__ ||
    null;
  return fromGlobal != null ? String(fromGlobal) : null;
}
