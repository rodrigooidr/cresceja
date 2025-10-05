// frontend/src/api/admin/orgsApi.js

const API_BASE = "/api";
const API_BASE_ADMIN = "/api/admin";

/* ========= Helpers para obter token/org ========= */

function getToken() {
  const stores = [localStorage, sessionStorage];

  // chaves diretas
  for (const s of stores) {
    const direct = s.getItem("authToken") || s.getItem("token") || s.getItem("jwt") || s.getItem("JWT");
    if (direct && direct.startsWith("eyJ")) return direct;
  }

  // objeto "auth" serializado
  for (const s of stores) {
    const raw = s.getItem("auth");
    if (!raw) continue;
    if (raw.startsWith("eyJ")) return raw;
    try {
      const obj = JSON.parse(raw);
      if (obj?.token && String(obj.token).startsWith("eyJ")) return obj.token;
      if (obj?.authToken && String(obj.authToken).startsWith("eyJ")) return obj.authToken;
    } catch { /* ignore */ }
  }

  return null;
}

function getOrgId() {
  const stores = [localStorage, sessionStorage];
  for (const s of stores) {
    const v =
      s.getItem("orgId") ||
      s.getItem("orgID") ||
      s.getItem("org_id") ||
      s.getItem("orgIdSelected");
    if (v) return v;
  }
  return null;
}

/* ========= Wrapper com fallback /api/admin -> /api ========= */

async function requestJson(method, path, { query, body } = {}) {
  const token = getToken();
  const orgId = getOrgId();

  const makeUrl = (base) => {
    const u = new URL(`${base}${path}`, window.location.origin);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
      }
    }
    return u.toString();
  };

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",   // deixa explícito quando faltar
    "X-Org-Id": orgId || "",
  };

  // 1ª tentativa em /api/admin
  let res = await fetch(makeUrl(API_BASE_ADMIN), {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Se 404, tenta rota equivalente em /api
  if (res.status === 404) {
    res = await fetch(makeUrl(API_BASE), {
      method,
      credentials: "include",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  if (res.status === 401) {
    throw new Error("missing_token");
  }
  if (!res.ok) {
    let errText = "";
    try { errText = await res.text(); } catch { /* ignore */ }
    throw new Error(errText || `http_error_${res.status}`);
  }
  // 204 sem body
  if (res.status === 204) return null;

  return res.json();
}

/* ========= Orgs (Admin) ========= */

export async function listOrgs({ status, q } = {}) {
  return requestJson("GET", "/orgs", { query: { status, q } });
}

export async function getOrg(id) {
  if (!id) throw new Error("org_id_required");
  return requestJson("GET", `/orgs/${encodeURIComponent(id)}`);
}

export async function createOrg(payload) {
  // payload esperado: { name, slug?, status?, plan_id? ... }
  return requestJson("POST", "/orgs", { body: payload });
}

export async function updateOrg(id, payload) {
  if (!id) throw new Error("org_id_required");
  return requestJson("PATCH", `/orgs/${encodeURIComponent(id)}`, { body: payload });
}

export async function deleteOrg(id) {
  if (!id) throw new Error("org_id_required");
  return requestJson("DELETE", `/orgs/${encodeURIComponent(id)}`);
}

// ===== CODEx: BEGIN admin org helpers =====
export async function updateOrgStatus(orgId, status) {
  if (!orgId) throw new Error("org_id_required");
  return requestJson("PATCH", `/orgs/${encodeURIComponent(orgId)}/status`, {
    body: { status },
  });
}

export async function getOrgBillingHistory(orgId) {
  if (!orgId) throw new Error("org_id_required");
  const resp = await requestJson("GET", `/orgs/${encodeURIComponent(orgId)}/billing/history`);
  if (resp && typeof resp === "object" && resp.ok && resp.data) {
    return resp.data;
  }
  return resp;
}
// ===== CODEx: END admin org helpers =====
