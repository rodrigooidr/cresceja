// src/api/orgHeader.js

let __orgIdProvider = null;

/**
 * Permite que páginas definam uma função que retorna o orgId atual.
 * Ex.: setOrgIdHeaderProvider(() => selectedOrgId)
 */
export function setOrgIdHeaderProvider(fn) {
  __orgIdProvider = typeof fn === "function" ? fn : null;
}

/** Decodifica o payload de um JWT (sem validar) */
function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const seg = token.split(".")[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Retorna o orgId efetivo, seguindo a ordem:
 * 1) Provider explícito
 * 2) localStorage: activeOrg.id
 * 3) localStorage: orgId / org_id (variações)
 * 4) localStorage: user.org_id / user.orgId
 * 5) localStorage: auth/org no JSON
 * 6) JWT no storage (authToken/token/jwt ou auth.token)
 * 7) variáveis globais (__ORG_ID__, __TEST_ORG_ID__)
 */
export function computeOrgId() {
  try {
    // 1) provider
    if (__orgIdProvider) {
      const v = __orgIdProvider();
      if (v != null && String(v).trim() !== "") return String(v);
    }

    // 2..6) localStorage
    const ls = typeof localStorage !== "undefined" ? localStorage : null;
    if (ls) {
      // 2) activeOrg.id
      try {
        const active = JSON.parse(ls.getItem("activeOrg") || "null");
        if (active?.id) return String(active.id);
      } catch {}

      // 3) chaves diretas
      for (const k of ["orgId", "org_id", "ORG_ID", "orgid"]) {
        const v = ls.getItem(k);
        if (v && String(v).trim() !== "") return String(v);
      }

      // 4) dentro de user
      try {
        const user = JSON.parse(ls.getItem("user") || "null");
        if (user?.org_id) return String(user.org_id);
        if (user?.orgId) return String(user.orgId);
      } catch {}

      // 5) dentro de auth
      try {
        const auth = JSON.parse(ls.getItem("auth") || "null");
        if (auth?.org_id) return String(auth.org_id);
        if (auth?.orgId) return String(auth.orgId);
        if (auth?.activeOrg?.id) return String(auth.activeOrg.id);
      } catch {}

      // 6) JWTs
      const tokens = [];
      try { tokens.push(ls.getItem("authToken")); } catch {}
      try { tokens.push(ls.getItem("token")); } catch {}
      try { tokens.push(ls.getItem("jwt")); } catch {}
      try {
        const authObj = JSON.parse(ls.getItem("auth") || "null");
        if (authObj?.token) tokens.push(authObj.token);
      } catch {}

      for (const t of tokens.filter(Boolean)) {
        const payload = decodeJwtPayload(t);
        if (payload?.org_id) return String(payload.org_id);
        if (payload?.orgId) return String(payload.orgId);
      }
    }

    // 7) globais (útil em testes/dev)
    if (typeof window !== "undefined") {
      const g = window;
      if (g.__ORG_ID__) return String(g.__ORG_ID__);
      if (g.__TEST_ORG_ID__) return String(g.__TEST_ORG_ID__);
    }

    return null;
  } catch {
    return null;
  }
}

/** Headers a serem anexados em cada request (usado pelo axios interceptor) */
export function orgHeaders() {
  const orgId = computeOrgId();
  return orgId ? { "X-Org-Id": orgId } : {};
}
