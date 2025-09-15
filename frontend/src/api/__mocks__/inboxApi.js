import apiBase, {
  __mockRoute,
  __resetMockApi,
  __getLastRequest,
  __setFeatures,
  __setLimits,
  __setProgressScenario,
  searchOrgs,
  searchClients,
  getPlanFeatures,
  savePlanFeatures,
} from "./index";

const METHODS = ["get", "post", "put", "patch", "delete"];

const makeClient = (config = {}) => {
  const client = {
    __config: config,
    defaults: {
      baseURL: config.baseURL,
      headers: { ...(config.headers || {}) },
    },
    interceptors: {
      request: { use: () => {} },
      response: { use: () => {} },
    },
  };

  for (const method of METHODS) {
    client[method] = api[method];
  }

  return client;
};

// Clona a referência para manter a implementação original
const api = { ...apiBase };

// Envolva os métodos HTTP em jest.fn para suportar .mockImplementation no teste
for (const m of METHODS) {
  const orig = apiBase[m];
  api[m] = jest.fn((...args) => orig(...args));
}

const originalGet = api.get;
api.get = jest.fn((...args) => {
  const [url] = args;
  if (/^\/channels\/meta\/accounts\/[^/]+\/backfill\/status/.test(url)) {
    return Promise.resolve({ data: { last: null } });
  }
  if (/^\/settings\/google-calendar\/accounts/i.test(url)) {
    return Promise.resolve({ data: { items: [] } });
  }
  if (/^\/settings\/instagram\/accounts/i.test(url)) {
    return Promise.resolve({ data: { items: [] } });
  }
  return originalGet(...args);
});

// (opcional) se seu código usa interceptors, mantenha um stub seguro
api.interceptors = api.interceptors || {
  request: { use: () => {} },
  response: { use: () => {} },
};

// Oferece compatibilidade com axios.create nos testes
api.create = (config) => makeClient(config);

// Exponha utilidades no default (alguns testes chamam via default)
api.__mockRoute = __mockRoute;
api.__resetMockApi = __resetMockApi;
api.__getLastRequest = __getLastRequest;
api.__setFeatures = __setFeatures;
api.__setLimits = __setLimits;
api.__setProgressScenario = __setProgressScenario;

export default api;
export {
  __mockRoute,
  __resetMockApi,
  __getLastRequest,
  __setFeatures,
  __setLimits,
  __setProgressScenario,
  searchOrgs,
  searchClients,
  getPlanFeatures,
  savePlanFeatures,
};

