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
  const org = globalThis.__TEST_ORG__ || { id: "1", plan: { limits: {} }, features: {} };
  if (url.includes("/orgs/current")) return { data: org };
  if (url.includes("/plans/current")) return { data: org.plan || { limits: {} } };
  if (url.includes("/features")) return { data: org.features || {} };
  if (url.includes("/clients")) return { data: { items: [], total: 0 } };
  if (url.includes("/conversations")) return { data: { items: [], total: 0 } };
  if (url.includes("/snippets")) return { data: { items: [] } };
  if (url.includes("/channels/facebook"))
    return { data: org.channels?.facebook || { connected: false, pages: [], permissions: [] } };
  if (url.includes("/channels/instagram"))
    return { data: org.channels?.instagram || { connected: false, accounts: [], permissions: [] } };
  if (url.includes("/channels/calendar"))
    return { data: org.channels?.calendar || { connected: false, calendars: [], scopes: [] } };
  return { data: {} };
}

function capture(method, url, body, config = {}) {
  const headers = applyOrgIdHeader({ ...(config.headers || {}) });
  __lastRequest = { method, url, body, headers };

  const responder = matchHandler(method, url);
  if (responder) return Promise.resolve(responder({ url, method, body, headers }));

  return Promise.resolve(defaults(method, url, body, headers));
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

