// src/api/inboxApi.js
import axios from "axios";
import {
  getToken,
  getActiveOrgId,
  setOrgIdInStorage,
  findOrgIdInUrl,
} from "../services/session.js";
import { computeOrgId } from "./orgHeader.js";
import {
  listOrgs as listAdminOrgsBase,
  getOrg as getAdminOrgBase,
  createOrg as createAdminOrgBase,
  updateOrg as updateAdminOrgBase,
  deleteOrg as deleteAdminOrgBase,
} from './admin/orgsApi';

const isBrowser = typeof window !== "undefined";
const isTest = process.env.NODE_ENV === "test";
const fromEnvCRA = process.env.REACT_APP_API_BASE_URL; // CRA
const fromGlobal = isBrowser ? window.__API_BASE_URL__ : undefined;
// DEV usa /api; PROD usa .env.production; TEST força absoluto p/ evitar undefined
export const API_BASE_URL =
  fromEnvCRA ||
  fromGlobal ||
  (isTest ? "http://localhost:4000" : "/api");
export const apiUrl = String(API_BASE_URL); // alias garante string

// torna a base visível globalmente (útil para helpers que não usam axios)
try {
  if (typeof window !== "undefined") window.__API_BASE_URL__ = API_BASE_URL;
} catch {}

const inboxApi = axios.create({ baseURL: API_BASE_URL });
export const api = inboxApi;
export const client = inboxApi;

export function parseBRLToCents(input) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  }
  if (typeof input !== "string") return NaN;
  const norm = input
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!norm) return 0;
  const num = Number(norm);
  return Number.isFinite(num) ? Math.round(num * 100) : NaN;
}

export function centsToBRL(cents = 0, currency = "BRL") {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
}

// ===== Helpers (headers) =====
function setHeader(config, name, value) {
  try {
    if (!config.headers) config.headers = {};
    if (typeof config.headers.set === "function") config.headers.set(name, value);
    else config.headers[name] = value;
  } catch {}
}
function delHeader(config, name) {
  try {
    if (!config.headers) return;
    if (typeof config.headers.delete === "function") config.headers.delete(name);
    else delete config.headers[name];
  } catch {}
}
function getHeader(config, name) {
  try {
    if (!config?.headers) return undefined;
    if (typeof config.headers.get === "function") {
      const direct = config.headers.get(name);
      if (direct != null) return direct;
      return config.headers.get(name.toLowerCase());
    }
    const direct = config.headers[name];
    if (direct != null) return direct;
    const lookup = Object.keys(config.headers).find((key) => key?.toLowerCase() === String(name).toLowerCase());
    return lookup ? config.headers[lookup] : undefined;
  } catch {
    return undefined;
  }
}

// ===== Helpers (FormData, ids, etc.) =====
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
function pathOnly(u) {
  try { return new URL(u, API_BASE_URL).pathname; }
  catch { try { return new URL(u, window.location.origin).pathname; } catch { return u || ""; } }
}

// ===== Auth/Org headers helpers =====
function ensureAuthHeader(config) {
  try {
    if (!config.headers) config.headers = {};
    const token = getToken();
    if (!token) {
      delHeader(config, 'Authorization');
      if (config.headers?.authorization) delete config.headers.authorization;
      return config;
    }

    const hasHeader = getHeader(config, 'Authorization');
    if (!hasHeader) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.headers.authorization) delete config.headers.authorization;
  } catch {}
  return config;
}
function ensureImpersonateHeader(config) {
  try {
    const id = getImpersonateOrgId();
    if (id) setHeader(config, "X-Impersonate-Org-Id", id);
    // ⚠️ NÃO enviar Cache-Control no request (gera preflight desnecessário)
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

// ===== Boot headers (token/org) =====
try {
  const savedOrg = getActiveOrgId();
  if (savedOrg) {
    inboxApi.defaults.headers.common["X-Org-Id"] = savedOrg;
  } else if (inboxApi?.defaults?.headers?.common?.["X-Org-Id"]) {
    delete inboxApi.defaults.headers.common["X-Org-Id"];
  }
} catch {}

// ===== REQUEST interceptor =====
inboxApi.interceptors.request.use((config) => {
  // rota atual (path) para regras
  const path = pathOnly(config.url || "");
  const method = String(config.method || "get").toUpperCase();

  const isGlobal = config.meta?.scope === "global";
  const noAuth = !!config.meta?.noAuth || path.startsWith("/auth/");
  const isPublic =
    path.startsWith("/public/") ||
    path.startsWith("/webhooks") ||
    path === "/health" ||
    path === "/ping";

  let orgFromUrl = null;
  try {
    const baseCandidate = typeof window !== 'undefined' ? window.location.origin : API_BASE_URL;
    const baseUrl =
      baseCandidate && /^https?:/i.test(String(baseCandidate))
        ? String(baseCandidate)
        : 'http://localhost';
    const parsed = new URL(config.url || '', baseUrl);
    const pathMatch = parsed.pathname.match(/\/api\/orgs\/([a-f0-9-]{36})/i);
    if (pathMatch?.[1]) {
      orgFromUrl = pathMatch[1];
    } else {
      const qsOrg = parsed.searchParams.get('orgId') || parsed.searchParams.get('org_id');
      if (qsOrg) orgFromUrl = qsOrg;
    }
  } catch {}
  if (!orgFromUrl) {
    try {
      orgFromUrl = findOrgIdInUrl(config.url || '') || null;
    } catch {
      orgFromUrl = null;
    }
  }

  const computedOrgId = computeOrgId();
  const fallbackOrgId = computedOrgId ?? getActiveOrgId();
  const orgId = orgFromUrl || fallbackOrgId || null;

  // Authorization
  if (noAuth) {
    delHeader(config, "Authorization");
  } else {
    config = ensureAuthHeader(config);
  }

  // Impersonação (se houver)
  config = ensureImpersonateHeader(config);
  try {
    const imp = config.meta?.impersonateOrgId;
    if (imp) {
      if (!config.headers) config.headers = {};
      config.headers["X-Impersonate-Org-Id"] = imp;
    }
  } catch {}

  // X-Org-Id: NÃO enviar para auth/health/public/global
  try {
    if (isGlobal || noAuth || isPublic) {
      delHeader(config, "X-Org-Id");
    } else {
      if (orgId) {
        setHeader(config, "X-Org-Id", String(orgId));
      } else {
        delHeader(config, "X-Org-Id");
      }
    }
  } catch {}

  // active channel header
  try {
    const channelOrgId = orgId || computedOrgId || computeOrgId();
    const key = channelOrgId ? `active_channel_id::${channelOrgId}` : null;
    const ch = key ? localStorage.getItem(key) : null;
    if (ch) setHeader(config, 'X-Channel-Id', ch);
  } catch {}

  // Reescritas
  if (config._skipRewrite) {
    log(`bypass rewrite for ${method} ${config.url}`);
    return config;
  }

  const original = config.url;
  try {
    const url = config.url || "";

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
      const msg = pickTextFrom(config.data);

      if (config.data instanceof FormData) {
        const fd = new FormData();
        setFormData(fd, "conversationId", normalizedId);
        setFormData(fd, "message", msg);
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
  else log(`no rewrite for ${method} ${config.url}`);
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
          const cfg = markRetry({
            ...config,
            url: "/inbox/messages",
            method: "post",
            data,
            _skipRewrite: true,
          });
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
    } else {
      localStorage.removeItem("token");
    }
    if (inboxApi?.defaults?.headers?.common) {
      delete inboxApi.defaults.headers.common.Authorization;
    }
    if (axios?.defaults?.headers?.common) {
      delete axios.defaults.headers.common.Authorization;
    }
  } catch {}
}
export function clearAuthToken() { setAuthToken(null); }
export function getAuthToken() { try { return localStorage.getItem("token"); } catch { return null; } }

export function setActiveOrg(id) {
  try {
    setOrgIdInStorage(id);
    if (id) {
      inboxApi.defaults.headers.common["X-Org-Id"] = String(id);
    } else {
      delete inboxApi.defaults.headers.common["X-Org-Id"];
    }
  } catch {}
}

export function getImpersonateOrgId() {
  try { return localStorage.getItem("impersonate.orgId") || ""; } catch { return ""; }
}
export function setImpersonateOrgId(orgId) {
  try {
    if (orgId) localStorage.setItem("impersonate.orgId", orgId);
    else localStorage.removeItem("impersonate.orgId");
  } catch {}
}

function withGlobalScope(options = {}) {
  const next = { ...(options || {}) };
  next.meta = { ...(options?.meta || {}) };
  if (!next.meta.scope) next.meta.scope = "global";
  return next;
}

export { listOrgs as adminListOrgs } from './admin/orgsApi';

export async function listAdminOrgs(status = "active", options = {}) {
  const params = { status };
  const q =
    options?.params?.q ??
    options?.params?.search ??
    options?.q ??
    options?.search ??
    '';
  if (q) params.q = String(q).trim();
  const extras = { ...(options?.params || {}) };
  delete extras.q;
  delete extras.search;
  delete extras.status;
  Object.entries(extras).forEach(([key, value]) => {
    if (value != null) params[key] = value;
  });
  return listAdminOrgsBase(params);
}

export async function patchAdminOrg(orgId, payload, _options = {}) {
  return updateAdminOrgBase(orgId, payload);
}

export async function getAdminOrg(orgId, _options = {}) {
  if (!orgId) return null;
  return getAdminOrgBase(orgId);
}

export async function postAdminOrg(payload, _options = {}) {
  return createAdminOrgBase(payload);
}

export async function deleteAdminOrg(id, _options = {}) {
  return deleteAdminOrgBase(id);
}

export async function getCurrentOrg(options = {}) {
  const config = withGlobalScope(options);
  const { data } = await api.get('/orgs/current', config);
  return data;
}

export async function getMyOrgs() {
  const { data } = await api.get('/orgs');
  if (data && typeof data === 'object' && Array.isArray(data.data)) {
    return { items: data.data, data: data.data };
  }
  return data;
}

export async function switchOrg(orgId) {
  await api.post('/orgs/select', { orgId });
}

export async function lookupCNPJ(cnpj) {
  const config = withGlobalScope();
  const { data } = await api.get(`/utils/cnpj/${encodeURIComponent(cnpj)}`, config);
  return data;
}

export async function lookupCEP(cep) {
  const config = withGlobalScope();
  const { data } = await api.get(`/utils/cep/${encodeURIComponent(cep)}`, config);
  return data;
}

export async function getPlanCredits(planId) {
  const { data } = await api.get(`/admin/plans/${planId}/credits`, withGlobalScope());
  return data?.data ?? [];
}

export async function setPlanCredits(planId, payload /* {data:[{meter,limit}]} */) {
  const { data } = await api.put(`/admin/plans/${planId}/credits`, payload, withGlobalScope());
  return data?.data ?? [];
}

export async function putAdminOrgPlan(orgId, payload, options = {}) {
  return inboxApi.put(`/admin/orgs/${orgId}/plan`, payload, withGlobalScope(options));
}

export async function patchAdminOrgCredits(orgId, payload, options = {}) {
  return inboxApi.patch(`/admin/orgs/${orgId}/credits`, payload, withGlobalScope(options));
}

export async function getOrgPlanSummary(orgId, options = {}) {
  return inboxApi.get(`/orgs/${orgId}/plan/summary`, options);
}

export async function listAdminPlans(options = {}) {
  return inboxApi.get(`/admin/plans`, withGlobalScope(options));
}

export async function adminListPlans(options = {}) {
  const { data: resp, status } = await client.get("/admin/plans", withGlobalScope(options));
  if (status !== 200) throw new Error(`admin/plans ${status}`);

  // Formatos aceitos (ordem de prioridade):
  // 1) { data: { plans: [], feature_defs: [], plan_features: [] } }
  // 2) { plans: [], feature_defs: [], plan_features: [] }
  // 3) { data: [...], meta: { feature_defs, plan_features } }
  // 4) [...array] (legado)
  if (resp?.data && typeof resp.data === "object") {
    const plans = Array.isArray(resp.data.plans) ? resp.data.plans : [];
    const feature_defs = Array.isArray(resp.data.feature_defs) ? resp.data.feature_defs : [];
    const plan_features = Array.isArray(resp.data.plan_features) ? resp.data.plan_features : [];
    return { plans, feature_defs, plan_features };
  }

  if (resp && Array.isArray(resp.plans)) {
    return {
      plans: resp.plans,
      feature_defs: Array.isArray(resp.feature_defs) ? resp.feature_defs : [],
      plan_features: Array.isArray(resp.plan_features) ? resp.plan_features : [],
    };
  }

  if (resp && Array.isArray(resp.data)) {
    return {
      plans: resp.data,
      feature_defs: Array.isArray(resp.meta?.feature_defs) ? resp.meta.feature_defs : [],
      plan_features: Array.isArray(resp.meta?.plan_features) ? resp.meta.plan_features : [],
    };
  }

  if (Array.isArray(resp)) {
    return { plans: resp, feature_defs: [], plan_features: [] };
  }

  const keys = resp && typeof resp === "object" ? Object.keys(resp) : [];
  throw new Error(`admin/plans payload inválido - got: ${keys.join(",")}`);
}

export async function adminCreatePlan(payload, options = {}) {
  return inboxApi.post(`/admin/plans`, payload, withGlobalScope(options));
}

export async function adminUpdatePlan(planId, payload, options = {}) {
  return inboxApi.patch(`/admin/plans/${planId}`, payload, withGlobalScope(options));
}

export async function adminDuplicatePlan(planId, options = {}) {
  return inboxApi.post(`/admin/plans/${planId}/duplicate`, {}, withGlobalScope(options));
}

export async function adminDeletePlan(planId, options = {}) {
  return inboxApi.delete(`/admin/plans/${planId}`, withGlobalScope(options));
}

export async function adminGetPlanFeatures(planId, options = {}) {
  if (!planId) return [];
  const res = await client.get(`/admin/plans/${planId}/features`, withGlobalScope(options));
  if (res?.status !== 200) throw new Error(`admin/plans/${planId}/features ${res?.status}`);
  const data = res?.data;
  if (!Array.isArray(data)) throw new Error('admin/plans features payload inválido');
  return data;
}

export async function adminGetPlanCredits(planId, options = {}) {
  if (!planId) {
    return [];
  }

  try {
    const r = await inboxApi.get(`/admin/plans/${planId}/credits`, withGlobalScope(options));
    return Array.isArray(r.data?.data) ? r.data.data : [];
  } catch (error) {
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function adminUpdatePlanCredits(planId, credits, options = {}) {
  if (!planId) {
    return [];
  }

  const payload = Array.isArray(credits) ? credits : [];
  const r = await inboxApi.put(
    `/admin/plans/${planId}/credits`,
    { data: payload },
    withGlobalScope(options)
  );
  return Array.isArray(r.data?.data) ? r.data.data : [];
}

export async function adminGetPlanCreditsSummary(planId, options = {}) {
  if (!planId) {
    return { plan_id: planId ?? null, credits: [] };
  }

  try {
    const credits = await adminGetPlanCredits(planId, options);
    return { plan_id: planId, credits };
  } catch (error) {
    if (error?.response?.status === 404) {
      return { plan_id: planId, credits: [] };
    }
    throw error;
  }
}

export async function adminPutPlanFeatures(planId, features, options = {}) {
  return inboxApi.put(`/admin/plans/${planId}/features`, features, withGlobalScope(options));
}

export default inboxApi;
export {
  adminCreatePlan as createPlan,
  adminUpdatePlan as updatePlan,
};
export { setOrgIdHeaderProvider } from "./orgHeader.js";
