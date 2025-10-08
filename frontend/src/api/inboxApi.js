// src/api/inboxApi.js
import axios from "axios";
import {
  getToken,
  getActiveOrgId,
  setOrgIdInStorage,
} from "../services/session.js";
import { computeOrgId } from "./orgHeader.js";
import {
  listOrgs as listAdminOrgsBase,
  getOrg as getAdminOrgBase,
  createOrg as createAdminOrgBase,
  updateOrg as updateAdminOrgBase,
  deleteOrg as deleteAdminOrgBase,
} from "./admin/orgsApi";

// =========================
// Base URL
// =========================
const isBrowser = typeof window !== "undefined";
const isTest = process.env.NODE_ENV === "test";
const fromEnvCRA = process.env.REACT_APP_API_BASE_URL;
const fromGlobal = isBrowser ? window.__API_BASE_URL__ : undefined;
const rawApiBase = fromEnvCRA || fromGlobal || (isTest ? "http://localhost:4000" : "/api");

export const API_BASE_URL = String(rawApiBase || "/api").replace(/\/+$/, "");

export function joinApi(path) {
  let p = String(path || "");
  if (/^https?:\/\//i.test(p)) return p;
  if (!p.startsWith("/")) p = `/${p}`;
  // evita /api/api/...
  if (API_BASE_URL.endsWith("/api") && p.startsWith("/api/")) {
    p = p.slice(4);
  }
  return `${API_BASE_URL}${p}`;
}

try {
  if (typeof window !== "undefined") window.__API_BASE_URL__ = API_BASE_URL;
} catch {}

// =========================
/** Axios client */
// =========================
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
// após inicialização, evitamos base duplicada pois o joinApi já inclui o prefixo
api.defaults.baseURL = "";

const HTTP_METHODS_WITH_DATA = new Set(["post", "put", "patch"]);
const HTTP_METHODS_WITHOUT_DATA = new Set(["get", "delete", "head", "options"]);

function wrapRequestMethod(method) {
  const original = api[method].bind(api);
  if (HTTP_METHODS_WITH_DATA.has(method)) {
    return (path, data, config) => {
      const url = typeof path === "string" ? joinApi(path) : path;
      return original(url, data, config);
    };
  }
  if (HTTP_METHODS_WITHOUT_DATA.has(method)) {
    return (path, config) => {
      const url = typeof path === "string" ? joinApi(path) : path;
      return original(url, config);
    };
  }
  return (...args) => original(...args);
}

[...HTTP_METHODS_WITH_DATA, ...HTTP_METHODS_WITHOUT_DATA].forEach((method) => {
  if (typeof api[method] === "function") {
    api[method] = wrapRequestMethod(method);
  }
});

export function getAuthToken() {
  try {
    const stored = localStorage.getItem("token");
    if (stored) return stored;
  } catch {}

  try {
    const match = typeof document !== "undefined"
      ? document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)
      : null;
    if (match) return decodeURIComponent(match[1]);
  } catch {}

  try {
    const fallback = getToken();
    if (fallback) return fallback;
  } catch {}

  return null;
}

export { api };
export const client = api; // alias
export default api;

// =========================
// Utils de moeda
// =========================
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

// =========================
// Helpers de headers
// =========================
function isPublicPath(path = "") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return (
    p.startsWith("/auth/") ||
    p.startsWith("/public/") ||
    p.startsWith("/webhooks") ||
    p === "/health" ||
    p === "/ping"
  );
}

function ensureAuthorization(headers) {
  const token = getAuthToken();
  if (!token) {
    delete headers.Authorization;
    delete headers.authorization;
    return;
  }
  if (!headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  } else if (headers.authorization && !headers.Authorization) {
    headers.Authorization = headers.authorization;
    delete headers.authorization;
  }
}

function resolveOrgIdForRequest() {
  try {
    // ordem de prioridade:
    // 1) computeOrgId (pode ler token e storage)
    // 2) getActiveOrgId (storage)
    // 3) activeOrg.id salvo como JSON
    const computed = computeOrgId();
    if (computed) return computed;

    const act = getActiveOrgId();
    if (act) return String(act);

    const raw = localStorage.getItem("activeOrg");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return String(parsed.id);
    }
  } catch {}
  return null;
}

function ensureOrgHeader(headers, path, meta) {
  const globalScope = meta?.scope === "global";
  if (globalScope || isPublicPath(path) || meta?.noOrgHeader) {
    delete headers["X-Org-Id"];
    delete headers["x-org-id"];
    return;
  }
  const orgId = resolveOrgIdForRequest();
  if (orgId) {
    headers["X-Org-Id"] = orgId;
  } else {
    delete headers["X-Org-Id"];
    delete headers["x-org-id"];
  }
}

// boot default X-Org-Id (útil para libs que usam defaults)
try {
  const savedOrg = getActiveOrgId();
  if (savedOrg) {
    api.defaults.headers.common["X-Org-Id"] = String(savedOrg);
  } else {
    delete api.defaults.headers.common["X-Org-Id"];
  }
} catch {}

// =========================
/** Interceptors */
// =========================
api.interceptors.request.use((config) => {
  const cfg = config || {};
  const path =
    typeof cfg.url === "string"
      ? new URL(cfg.url, "http://local").pathname
      : "/";

  cfg.headers = cfg.headers || {};

  // 1) Auth
  if (!cfg.meta?.noAuth && !isPublicPath(path)) {
    ensureAuthorization(cfg.headers);
  } else {
    delete cfg.headers.Authorization;
    delete cfg.headers.authorization;
  }

  // 2) Org
  ensureOrgHeader(cfg.headers, path, cfg.meta || {});

  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem("token");
      } catch {}
      try {
        if (typeof document !== "undefined") {
          document.cookie = "access_token=; Max-Age=0; path=/";
        }
      } catch {}
      if (
        typeof window !== "undefined" &&
        window.location?.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// =========================
// Token helpers
// =========================
export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    delete api.defaults.headers.common.Authorization;
    delete axios.defaults.headers?.common?.Authorization;
  } catch {}
}
export function clearAuthToken() {
  setAuthToken(null);
}
export function getAuthToken() {
  try {
    const token = localStorage.getItem("token");
    if (token) return token;
    const fromCookie =
      typeof document !== "undefined"
        ? document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)
        : null;
    return fromCookie ? decodeURIComponent(fromCookie[1]) : null;
  } catch {
    return null;
  }
}

// =========================
// Org helpers
// =========================
export function setActiveOrg(id) {
  try {
    setOrgIdInStorage(id);
    if (id) api.defaults.headers.common["X-Org-Id"] = String(id);
    else delete api.defaults.headers.common["X-Org-Id"];
  } catch {}
}

export function getImpersonateOrgId() {
  try {
    return localStorage.getItem("impersonate.orgId") || "";
  } catch {
    return "";
  }
}
export function setImpersonateOrgId(orgId) {
  try {
    if (orgId) localStorage.setItem("impersonate.orgId", orgId);
    else localStorage.removeItem("impersonate.orgId");
  } catch {}
}

// Mantemos este helper para rotas PÚBLICAS/ADMIN onde **não** queremos X-Org-Id.
// Para rotas com contexto de organização (ex.: /orgs/current), **NÃO** use.
function withGlobalScope(options = {}) {
  const next = { ...(options || {}) };
  next.meta = { ...(options?.meta || {}) };
  if (!next.meta.scope) next.meta.scope = "global";
  return next;
}

// =========================
// Orgs API (admin e atual)
// =========================
export { listOrgs as adminListOrgs } from "./admin/orgsApi";

export async function listAdminOrgs(status = "active", options = {}) {
  const params = { status };
  const q =
    options?.params?.q ??
    options?.params?.search ??
    options?.q ??
    options?.search ??
    "";
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

/** ✅ org corrente (NÃO usa withGlobalScope; mantém X-Org-Id) */
export async function getCurrentOrg(options = {}) {
  const { data } = await api.get("/orgs/current", options);
  return data;
}

// orgs do usuário (formato compat)
export async function getMyOrgs() {
  const { data } = await api.get("/orgs");
  if (data && typeof data === "object" && Array.isArray(data.data)) {
    return { items: data.data, data: data.data };
  }
  return data;
}

// seleciona org ativa (back pode validar; front salva via setActiveOrg)
export async function switchOrg(orgId) {
  // não enviar X-Org-Id nesta rota
  await api.post('/orgs/select', { orgId }, { meta: { noOrgHeader: true } });
  // manter header/storage imediatos no cliente para UX responsiva
  setActiveOrg(orgId);
}

// =========================
// Utils de busca externa (públicas)
// =========================
export async function lookupCNPJ(cnpj) {
  const { data } = await api.get(
    `/utils/cnpj/${encodeURIComponent(cnpj)}`,
    withGlobalScope()
  );
  return data;
}
export async function lookupCEP(cep) {
  const { data } = await api.get(
    `/utils/cep/${encodeURIComponent(cep)}`,
    withGlobalScope()
  );
  return data;
}

// =========================
/** Plans/Admin (mantidos como "global") */
// =========================
export async function getPlanCredits(planId) {
  const { data } = await api.get(
    `/admin/plans/${planId}/credits`,
    withGlobalScope()
  );
  return data?.data ?? [];
}
export async function setPlanCredits(planId, payload) {
  const { data } = await api.put(
    `/admin/plans/${planId}/credits`,
    payload,
    withGlobalScope()
  );
  return data?.data ?? [];
}
export async function putAdminOrgPlan(orgId, payload, options = {}) {
  return api.put(`/admin/orgs/${orgId}/plan`, payload, withGlobalScope(options));
}
export async function patchAdminOrgCredits(orgId, payload, options = {}) {
  return api.patch(`/admin/orgs/${orgId}/credits`, payload, withGlobalScope(options));
}
export async function getOrgPlanSummary(orgId, options = {}) {
  return api.get(`/orgs/${orgId}/plan/summary`, options);
}
export async function listAdminPlans(options = {}) {
  return api.get(`/admin/plans`, withGlobalScope(options));
}
export async function adminListPlans(options = {}) {
  const { data: resp, status } = await client.get(
    "/admin/plans",
    withGlobalScope(options)
  );
  if (status !== 200) throw new Error(`admin/plans ${status}`);

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
  return api.post(`/admin/plans`, payload, withGlobalScope(options));
}
export async function adminUpdatePlan(planId, payload, options = {}) {
  return api.patch(`/admin/plans/${planId}`, payload, withGlobalScope(options));
}
export async function adminDuplicatePlan(planId, options = {}) {
  return api.post(`/admin/plans/${planId}/duplicate`, {}, withGlobalScope(options));
}
export async function adminDeletePlan(planId, options = {}) {
  return api.delete(`/admin/plans/${planId}`, withGlobalScope(options));
}
export async function adminGetPlanFeatures(planId, options = {}) {
  if (!planId) return [];
  const res = await client.get(`/admin/plans/${planId}/features`, withGlobalScope(options));
  if (res?.status !== 200) throw new Error(`admin/plans/${planId}/features ${res?.status}`);
  const data = res?.data;
  if (!Array.isArray(data)) throw new Error("admin/plans features payload inválido");
  return data;
}
export async function adminGetPlanCredits(planId, options = {}) {
  if (!planId) return [];
  try {
    const r = await api.get(`/admin/plans/${planId}/credits`, withGlobalScope(options));
    return Array.isArray(r.data?.data) ? r.data.data : [];
  } catch (error) {
    if (error?.response?.status === 404) return [];
    throw error;
  }
}
export async function adminUpdatePlanCredits(planId, credits, options = {}) {
  if (!planId) return [];
  const payload = Array.isArray(credits) ? credits : [];
  const r = await api.put(
    `/admin/plans/${planId}/credits`,
    { data: payload },
    withGlobalScope(options)
  );
  return Array.isArray(r.data?.data) ? r.data.data : [];
}
export async function adminGetPlanCreditsSummary(planId, options = {}) {
  if (!planId) return { plan_id: planId ?? null, credits: [] };
  try {
    const credits = await adminGetPlanCredits(planId, options);
    return { plan_id: planId, credits };
  } catch (error) {
    if (error?.response?.status === 404) return { plan_id: planId, credits: [] };
    throw error;
  }
}
export async function adminPutPlanFeatures(planId, features, options = {}) {
  return api.put(`/admin/plans/${planId}/features`, features, withGlobalScope(options));
}

// ===== Billing / Histórico =====
export async function adminGetOrgBillingHistory(orgId) {
  const { data } = await api.get(`/admin/orgs/${orgId}/billing/history`, {
    meta: { scope: 'global' },
  });
  if (!data?.ok) throw new Error(JSON.stringify(data || {}));
  return data.data;
}

export async function getOrgBillingHistory(orgId) {
  const { data } = await api.get(`/orgs/${orgId}/billing/history`);
  if (!data?.ok) throw new Error(JSON.stringify(data || {}));
  return data.data;
}

// ===== Planos =====
export async function adminListPlansShort() {
  const { data: resp } = await api.get(`/admin/plans`, { meta: { scope: 'global' } });
  const plans =
    (resp?.data?.plans ?? resp?.plans ?? resp?.data ?? (Array.isArray(resp) ? resp : [])).map((p) => ({
      id: p.id ?? p.plan_id ?? p.uuid,
      name: p.name ?? p.title ?? p.slug ?? 'Plano',
    }));
  return plans;
}

export async function adminPutOrgPlan(orgId, planId) {
  return api.put(
    `/admin/orgs/${orgId}/plan`,
    { plan_id: planId },
    { meta: { scope: 'global' } }
  );
}

export {
  adminCreatePlan as createPlan,
  adminUpdatePlan as updatePlan,
};

export { setOrgIdHeaderProvider } from "./orgHeader.js";
