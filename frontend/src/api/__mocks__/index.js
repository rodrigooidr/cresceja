import { applyOrgIdHeader, setOrgIdHeaderProvider } from "../orgHeader.js";

function normalizeListLike(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items)) return x.items;    // aceita { items: [...] }
  if (x && typeof x === "object" && Array.isArray(x.data)) return x.data; // { data: [...] }
  return []; // qualquer outra coisa vira lista vazia
}

function normalizeDataShape(data) {
  if (data == null) return {};
  if (Array.isArray(data)) return data;

  // Clona raso e normaliza chaves comuns de “lista”
  const out = { ...data };
  const listKeys = ["items", "pages", "accounts", "calendars", "numbers", "templates", "results", "list", "types"];
  for (const k of listKeys) {
    if (k in out && !Array.isArray(out[k])) {
      out[k] = normalizeListLike(out[k]);
    }
  }
  return out;
}

function normalizeResponse(method, url, res) {
  // Aceita responderes que devolvem { data: ... } ou direto um objeto
  const payload = res && "data" in res ? res.data : res;
  const normalized = normalizeDataShape(payload);
  // Log leve para identificar o endpoint que veio torto (só em teste)
  if (process.env.NODE_ENV === "test" && payload !== normalized) {
    // eslint-disable-next-line no-console
    console.warn("[mockApi] normalized list-like payload:", method, url);
  }
  return { data: normalized };
}

let __lastRequest = null;
function __getLastRequest() {
  return __lastRequest;
}

function __setFeatures(features = {}) {
  const org = globalThis.__TEST_ORG__ || { id: "1", plan: { limits: {} }, features: {}, channels: {} };
  org.features = { ...(org.features || {}), ...(features || {}) };
  globalThis.__TEST_ORG__ = org;
}

function __setLimits(limits = {}) {
  const org = globalThis.__TEST_ORG__ || { id: "1", plan: { limits: {} }, features: {}, channels: {} };
  org.plan = { ...(org.plan || {}), limits: { ...(org.plan?.limits || {}), ...(limits || {}) } };
  globalThis.__TEST_ORG__ = org;
}

// ===== Instagram video progress scenarios =====
const __progressScenarios = new Map(); // key: jobKey -> { steps: number[], i: number }

function __setProgressScenario(jobKey, steps = [0, 25, 60, 100]) {
  const safe = (Array.isArray(steps) && steps.length ? steps : [0, 100])
    .map(n => Math.max(0, Math.min(100, Number(n) || 0)));
  __progressScenarios.set(String(jobKey || "default"), { steps: safe, i: 0 });
}

function nextProgressFor(jobKey) {
  const key = String(jobKey || "default");
  if (!__progressScenarios.has(key)) {
    __progressScenarios.set(key, { steps: [0, 25, 60, 100], i: 0 });
  }
  const s = __progressScenarios.get(key);
  const value = s.steps[Math.min(s.i, s.steps.length - 1)];
  if (s.i < s.steps.length - 1) s.i += 1;
  const done = value >= 100;
  const status = done ? "done" : "processing";
  return { progress: value, status };
}

function extractJobKey(url, params) {
  // tenta ?jobId=xxx
  if (params && params.jobId) return params.jobId;
  // tenta path /.../:jobId/progress
  const m = url.match(/\/([A-Za-z0-9_-]{6,})\/progress(\?|$)/i);
  if (m) return m[1];
  // tenta /jobId=xxx em query crua
  const mq = url.match(/[?&]jobId=([^&]+)/i);
  if (mq) return decodeURIComponent(mq[1]);
  // fallback: a própria URL
  return url;
}

// 🔧 Registry de rotas: permita que testes registrem respostas específicas
const handlers = { GET: [], POST: [], PUT: [], PATCH: [], DELETE: [] };
function __mockRoute(method, matcher, responder) {
  const m = String(method || "GET").toUpperCase();
  handlers[m].push([matcher, responder]);
}
function __resetMockApi() {
  Object.keys(handlers).forEach(k => {
    handlers[k] = [];
  });
  __lastRequest = null;
  __progressScenarios.clear?.();
}
function matchHandler(method, url) {
  for (const [matcher, responder] of handlers[method]) {
    if (typeof matcher === "string" && matcher === url) return responder;
    if (matcher instanceof RegExp && matcher.test(url)) return responder;
  }
  return null;
}

// 🧩 Respostas default (formatos que os componentes esperam)
function defaults(method, url, body, headers) {
  const org = globalThis.__TEST_ORG__ || { id: "1", plan: { limits: {} }, features: {}, channels: {} };
  const waDefault = { connected: false, provider: "", phone: "", numbers: [], templates: [] };
  const emptyList = { items: [], total: 0 };
  const ok = { data: { ok: true } };

  // ---- BUSCAS / LISTAGENS GENÉRICAS ----
  // Orgs
  if (/\/admin\/orgs(\?.*)?$/i.test(url) || /\/orgs\/search/i.test(url) || /\/organizations\/search/i.test(url)) {
    return { data: { items: [{ id: "org1", name: "Org 1" }, { id: "org2", name: "Org 2" }], total: 2 } };
  }
  // Clients
  if (/\/admin\/clients(\?.*)?$/i.test(url) || /\/clients\/search/i.test(url)) {
    return { data: { items: [{ id: "c1", name: "Alice" }, { id: "c2", name: "Bob" }], total: 2 } };
  }
  // Usuários (caso algum teste busque)
  if (/\/admin\/users(\?.*)?$/i.test(url) || /\/users\/search/i.test(url)) {
    return { data: { items: [{ id: "u1", email: "test@example.com" }], total: 1 } };
  }

  if (url.includes("/orgs/current"))       return { data: org };
  if (url.includes("/plans/current"))      return { data: org.plan || { limits: {} } };
  if (url.includes("/features"))           return { data: org.features || {} };
  if (url.includes("/clients"))            return { data: emptyList };
  if (url.includes("/conversations"))      return { data: emptyList };
  if (url.includes("/snippets"))           return { data: { items: [] } };
  if (url.includes("/channels/facebook"))  return { data: org.channels?.facebook  || { connected:false, pages:[], permissions:[] } };
  if (url.includes("/channels/instagram")) return { data: org.channels?.instagram || { connected:false, accounts:[], permissions:[] } };
  if (url.includes("/channels/calendar"))  return { data: org.channels?.calendar  || { connected:false, calendars:[{id:"primary", summary:"Agenda principal"}], scopes:[] } };
  if (url.includes("/channels/whatsapp"))  return { data: org.channels?.whatsapp  || waDefault };
  if (url.includes("/whatsapp"))           return { data: { items: [] } };
  // OAuth genérico usado nas seções
  if (url.includes("/oauth/facebook")) return ok;
  if (url.includes("/oauth/instagram")) return ok;
  if (url.includes("/oauth/google")) return ok;
  if (url.includes("/oauth/state")) return ok;
  // comuns em testes de mídia/marketing
  if (url.includes("/media") || url.includes("/uploads")) return { data: { id: "upload_test", url: "/mock.png" } };
  if (url.includes("/images")) return { data: emptyList };
  if (url.includes("/marketing/instagram/publish/progress")) return { data: { progress: 100, status: "done" } };
  // Rotas comuns que às vezes aparecem em Settings e adjacências
  if (/facebook.*pages/i.test(url))   return { data: [{ id: "fbp1", name: "Minha Página" }] };
  if (/instagram.*accounts/i.test(url) && !/\/orgs\/[^/]+\/instagram\/accounts/i.test(url)) {
    return { data: [{ id: "iga1", name: "Minha Conta IG" }] };
  }
  if (/calendar.*calendars/i.test(url)) return { data: [{ id: "primary", summary: "Agenda principal" }] };
  if (/calendar.*accounts/i.test(url))  return { data: [{ id: "primary", summary: "Agenda principal" }] };

  // “search genérico” que alguns componentes usam
  if (/\/search(\?|$)/i.test(url)) return { data: { items: [], total: 0 } };

  // ===== Instagram Publisher (org-scoped) =====
  // Contas vinculadas da org (garante que a UI não mostre "Nenhuma conta.")
  if (/\/orgs\/[^/]+\/instagram\/accounts(\?.*)?$/i.test(url)) {
    return { data: { items: [{ id: "iga1", name: "IG Test Account", username: "@igtest" }] } };
  }
  // Jobs da org (lista inicial)
  if (/\/orgs\/[^/]+\/instagram\/jobs(\?.*)?$/i.test(url)) {
    return { data: { items: [] } };
  }
  // Criar publicação (imagem/vídeo)
  if (/\/orgs\/[^/]+\/instagram(?:\/accounts\/[^/]+)?\/publish(\?.*)?$/i.test(url) && method === "POST") {
    const jobId = "job_ig_123";
    return { data: { id: jobId, jobId, status: "queued" } };
  }
  // Cancelar job
  if (/\/orgs\/[^/]+\/instagram\/jobs\/[^/]+\/cancel(\?.*)?$/i.test(url) && method !== "GET") {
    return { data: { ok: true } };
  }

  // Tipos/opções de publicação (para o select "Imagem"/"Vídeo")
  if (/instagram.*publish.*(types|options)/i.test(url)) {
    return {
      data: {
        types: [
          { value: "image", label: "Imagem" },
          { value: "video", label: "Vídeo" },
        ],
      },
    };
  }

  return { data: {} };
}

function capture(method, url, body, config = {}) {
  const headers = applyOrgIdHeader({ ...(config.headers || {}) });
  __lastRequest = { method, url, body, headers, params: config.params || undefined };

  // 🎯 Instagram video progress (aceita vários formatos)
  if (
    method === "GET" &&
    /instagram/i.test(url) &&
    /(progress|videoProgress)/i.test(url)
  ) {
    const jobKey = extractJobKey(url, config.params);
    const payload = nextProgressFor(jobKey);
    return Promise.resolve({ data: payload });
  }

  const responder = matchHandler(method, url);
  if (responder) {
    const raw = responder({ url, method, body, headers, params: config.params });
    return Promise.resolve(normalizeResponse(method, url, raw));
  }

  const def = defaults(method, url, body, headers);
  if (process.env.NODE_ENV === "test" && (!def || (def && Object.keys(def.data || {}).length === 0))) {
    // ajuda a identificar os 1–2 endpoints finais sem mock
    // eslint-disable-next-line no-console
    console.warn("[mockApi] fallback default vazio:", method, url);
  }
  return Promise.resolve(normalizeResponse(method, url, def));
}

const api = {
  get: jest.fn((url, c) => capture("GET", url, undefined, c)),
  post: jest.fn((url, b, c) => capture("POST", url, b, c)),
  put: jest.fn((url, b, c) => capture("PUT", url, b, c)),
  patch: jest.fn((url, b, c) => capture("PATCH", url, b, c)),
  delete: jest.fn((url, c) => capture("DELETE", url, undefined, c)),
};

export default api;
export { setOrgIdHeaderProvider, __mockRoute, __resetMockApi, __getLastRequest, __setFeatures, __setLimits, __setProgressScenario };

// ✅ Adicione os utilitários também no *default* para testes que fazem inboxApi.__mockRoute(...)
api.__mockRoute = __mockRoute;
api.__resetMockApi = __resetMockApi;
api.__getLastRequest = __getLastRequest;
api.__setFeatures = __setFeatures;
api.__setLimits = __setLimits;
api.__setProgressScenario = __setProgressScenario;

// === Named exports esperados por testes ===
// Observação: eles apenas delegam para o mock default (GET/POST etc.)
export async function searchOrgs(query = "", opts = {}) {
  return api.get("/admin/orgs", { ...(opts || {}), params: { q: query, ...(opts?.params || {}) } });
}
export async function searchClients(query = "", opts = {}) {
  return api.get("/admin/clients", { ...(opts || {}), params: { q: query, ...(opts?.params || {}) } });
}
export async function getPlanFeatures(planId, opts = {}) {
  return api.get(`/admin/plans/${planId}/features`, opts);
}
export async function savePlanFeatures(planId, payload, opts = {}) {
  return api.put(`/admin/plans/${planId}/features`, payload, opts);
}

