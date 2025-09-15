import { applyOrgIdHeader, setOrgIdHeaderProvider } from "../orgHeader.js";

let __lastRequest = null;
export function __getLastRequest() {
  return __lastRequest;
}

// 🔧 Registry de rotas: permita que testes registrem respostas específicas
const handlers = { GET: [], POST: [], PUT: [], PATCH: [], DELETE: [] };
export function __mockRoute(method, matcher, responder) {
  const m = String(method || "GET").toUpperCase();
  handlers[m].push([matcher, responder]);
}
export function __resetMockApi() {
  Object.keys(handlers).forEach(k => {
    handlers[k] = [];
  });
  __lastRequest = null;
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
  return { data: {} };
}

function capture(method, url, body, config = {}) {
  const headers = applyOrgIdHeader({ ...(config.headers || {}) });
  __lastRequest = { method, url, body, headers };

  const responder = matchHandler(method, url);
  if (responder) return Promise.resolve(responder({ url, method, body, headers }));

  const def = defaults(method, url, body, headers);
  if (process.env.NODE_ENV === "test" && (!def || (def && Object.keys(def.data || {}).length === 0))) {
    // ajuda a identificar os 1–2 endpoints finais sem mock
    // eslint-disable-next-line no-console
    console.warn("[mockApi] fallback default vazio:", method, url);
  }
  return Promise.resolve(def);
}

const api = {
  get: jest.fn((url, c) => capture("GET", url, undefined, c)),
  post: jest.fn((url, b, c) => capture("POST", url, b, c)),
  put: jest.fn((url, b, c) => capture("PUT", url, b, c)),
  patch: jest.fn((url, b, c) => capture("PATCH", url, b, c)),
  delete: jest.fn((url, c) => capture("DELETE", url, undefined, c)),
};

export default api;
export { setOrgIdHeaderProvider };

// ✅ Adicione os utilitários também no *default* para testes que fazem inboxApi.__mockRoute(...)
api.__mockRoute = __mockRoute;
api.__resetMockApi = __resetMockApi;
api.__getLastRequest = __getLastRequest;

