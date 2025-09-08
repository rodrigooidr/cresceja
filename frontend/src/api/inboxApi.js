// src/api/inboxApi.js
import axios from "axios";

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000/api";
export const apiUrl = API_BASE_URL; // alias

const inboxApi = axios.create({ baseURL: API_BASE_URL });

// ===== Helpers =====
function getFromFormData(fd, key) {
  try { return fd instanceof FormData ? (fd.get ? fd.get(key) : null) : null; } catch { return null; }
}
function setFormData(fd, key, value) {
  try { if (fd.has(key)) fd.set(key, value); else fd.append(key, value); } catch {}
}
function pickTextFrom(obj) {
  if (obj instanceof FormData) {
    return getFromFormData(obj, "message")
        ?? getFromFormData(obj, "text")
        ?? getFromFormData(obj, "content")
        ?? getFromFormData(obj, "body")
        ?? "";
  }
  if (obj && typeof obj === "object") {
    return obj.message ?? obj.text ?? obj.content ?? obj.body ?? "";
  }
  return "";
}
function qsSelectedId() {
  try { return new URLSearchParams(window.location.search || "").get("c") || null; } catch { return null; }
}
function stripConvPrefix(id) {
  if (!id) return id;
  const m = String(id).match(/^conv[_-](.+)$/i);
  return m ? m[1] : id;
}
function hasConvPrefix(id) {
  return !!(id && /^conv[_-]/i.test(String(id)));
}
function canonicalId(id) {
  const q = qsSelectedId();
  if (hasConvPrefix(id) && q) return q;
  return stripConvPrefix(id || q);
}
function ensureAuthHeader(config) {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (t && !config.headers?.Authorization) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${t}`;
    }
  } catch {}
  return config;
}
function ensureImpersonateHeader(config) {
  try {
    const id = getImpersonateOrgId();
    if (id) {
      if (!config.headers) config.headers = {};
      config.headers["X-Impersonate-Org-Id"] = id;
    }
    if (!config.headers) config.headers = {};
    config.headers["Cache-Control"] = "no-store";
  } catch {}
  return config;
}
function markRetry(config) {
  const c = { ...config };
  c._retryChain = (config._retryChain || 0) + 1;
  return c;
}
function canRetry(config) {
  return (config._retryChain || 0) < 3;
}
function log(...args) {
  try { if (localStorage.getItem("INBOX_DEBUG") === "1") console.info("[inbox]", ...args); } catch {}
}

// Boot token
try {
  const bootToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (bootToken) {
    inboxApi.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
    axios.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
  }
} catch {}

// Boot org
try {
  const savedOrg = typeof window !== "undefined" ? localStorage.getItem("active_org_id") : null;
  if (savedOrg) {
    inboxApi.defaults.headers.common["X-Org-Id"] = savedOrg;
  }
} catch {}

// ===== REQUEST interceptor =====
inboxApi.interceptors.request.use((config) => {
  config = ensureAuthHeader(config);
  config = ensureImpersonateHeader(config);

  // aplica X-Org-Id em todas as chamadas, exceto quando marcado como global
  try {
    const isGlobal = config.meta?.scope === "global";
    const orgId = localStorage.getItem("active_org_id");
    if (isGlobal) {
      if (config.headers) delete config.headers["X-Org-Id"];
    } else if (orgId) {
      if (!config.headers) config.headers = {};
      config.headers["X-Org-Id"] = orgId;
    }
  } catch {}

  if (config._skipRewrite) {
    log(`bypass rewrite for ${config.method?.toUpperCase() || "GET"} ${config.url}`);
    return config;
  }

  const original = config.url;
  try {
    const url = config.url || "";
    const method = String(config.method || "get").toUpperCase();

    // A) /inbox/<id>/(messages|read|tags|ai)
    const mDirect = url.match(/^\/?inbox\/([^/]+)\/(messages|read|tags|ai)\b(.*)$/);
    if (mDirect) {
      const [, anyId, tail, rest] = mDirect;
      if (hasConvPrefix(anyId)) {
        log(`${method} keep conv_* URL: ${url}`);
        return config;
      }
      const id = canonicalId(anyId);
      const next = `/inbox/conversations/${id}/${tail}${rest || ""}`;
      log(`${method} rewrite: ${url} -> ${next}`);
      config.url = next;
      return config;
    }

    // B) /inbox/messages (POST)  -> manter e normalizar payload
    if (/^\/?inbox\/messages\/?$/.test(url) && method === "POST") {
      const cid =
        (config.data instanceof FormData
          ? (getFromFormData(config.data, "conversationId") || getFromFormData(config.data, "conversation_id") || canonicalId(null))
          : (config.data?.conversationId ?? config.data?.conversation_id ?? canonicalId(null))
        );

      const normalizedId = canonicalId(cid);

      // Construir payload estrito: { conversationId, message }
      const msg = pickTextFrom(config.data);

      if (config.data instanceof FormData) {
        const fd = new FormData();
        setFormData(fd, "conversationId", normalizedId);
        setFormData(fd, "message", msg);
        // se havia arquivo, preserva
        const file = getFromFormData(config.data, "file") || getFromFormData(config.data, "attachment");
        if (file) setFormData(fd, "file", file);
        config.data = fd;
      } else {
        config.data = { conversationId: normalizedId, message: msg };
      }

      log(`${method} keep /inbox/messages (normalized strict payload)`);
      return config;
    }
  } catch {}

  if (original !== config.url) log(`kept URL ${original} -> ${config.url}`);
  else log(`no rewrite for ${config.method?.toUpperCase() || "GET"} ${config.url}`);
  return config;
});

// ===== RESPONSE interceptor (fallback) =====
inboxApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) throw error;
    if (![404, 400, 415, 422, 500].includes(response.status)) throw error;
    if (!canRetry(config)) throw error;

    try {
      // Se já estamos enviando para /inbox/messages, não há fallback melhor no cliente.
      if (/^\/?inbox\/messages\/?$/.test(config.url || "")) throw error;

      const url = config.url || "";
      const mConv = url.match(/^\/?inbox\/conversations\/([^/]+)\/(messages|read|tags|ai)\b(.*)$/);
      if (mConv) {
        const [, idRaw, tail] = mConv;
        if (tail === "messages") {
          const id = stripConvPrefix(idRaw);
          // Enviar com payload estrito
          const strictMsg = pickTextFrom(config.data);
          let data;
          if (config.data instanceof FormData) {
            const fd = new FormData();
            setFormData(fd, "conversationId", id);
            setFormData(fd, "message", strictMsg);
            const file = getFromFormData(config.data, "file") || getFromFormData(config.data, "attachment");
            if (file) setFormData(fd, "file", file);
            data = fd;
          } else {
            data = { conversationId: id, message: strictMsg };
          }
          const cfg = markRetry({ ...config, url: "/inbox/messages", method: "post", data, _skipRewrite: true });
          log(`fallback -> /inbox/messages with strict payload`);
          return await inboxApi.request(cfg);
        }
      }
    } catch (e) {}
    throw error;
  }
);

// ==== Token helpers ====
export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem("token", token);
      inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem("token");
      delete inboxApi.defaults.headers.common.Authorization;
      delete axios.defaults.headers.common.Authorization;
    }
  } catch {}
}
export function clearAuthToken() { setAuthToken(null); }
export function getAuthToken() { try { return localStorage.getItem("token"); } catch { return null; } }

export function setActiveOrg(id) {
  try {
    if (id) {
      localStorage.setItem("active_org_id", id);
      inboxApi.defaults.headers.common["X-Org-Id"] = id;
    } else {
      localStorage.removeItem("active_org_id");
      delete inboxApi.defaults.headers.common["X-Org-Id"];
    }
  } catch {}
}

export function getImpersonateOrgId() {
  try { return localStorage.getItem("impersonate.orgId") || ""; } catch { return ""; }
}

export function setImpersonateOrgId(orgId) {
  try {
    if (orgId) {
      localStorage.setItem("impersonate.orgId", orgId);
    } else {
      localStorage.removeItem("impersonate.orgId");
    }
  } catch {}
}

export default inboxApi;
