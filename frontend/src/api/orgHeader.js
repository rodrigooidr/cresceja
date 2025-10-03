import { getOrgIdFromStorage } from "../services/session.js";

let orgIdProvider = null;

const globalScope =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : {};

export function setOrgIdHeaderProvider(fn) {
  orgIdProvider = typeof fn === "function" ? fn : null;
}

export function computeOrgId() {
  // 1) Provider (runtime)
  if (orgIdProvider) {
    try {
      const v = orgIdProvider();
      if (v != null && v !== "") return String(v);
    } catch {}
  }
  // 2) Persistência padrão (localStorage/session + fallback de testes)
  const stored = getOrgIdFromStorage();
  if (stored != null && stored !== "") return String(stored);

  // 3) fallback explícito (mantém compat com antigos debugs globais)
  const t = globalScope?.__TEST_ORG__?.id;
  if (t != null && t !== "") return String(t);

  return undefined;
}

export function applyOrgIdHeader(headers = {}) {
  if (headers["X-Org-Id"] == null) {
    const v = computeOrgId();
    if (v != null) headers["X-Org-Id"] = v;
  }
  return headers;
}
