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

const marketingJobs = [
  {
    id: "job-1",
    channel: "instagram",
    title: "Sugestão IG/FB #1",
    caption: "Legenda 1",
    status: "pending",
  },
  {
    id: "job-2",
    channel: "facebook",
    title: "Sugestão IG/FB #2",
    status: "pending",
  },
];

const originalGet = api.get;
const originalPost = api.post;

function handleGet(...args) {
  const [url] = args;
  if (typeof url === "string") {
    if (/\/marketing\/content\/jobs/.test(url) || /\/marketing\/calendar\/jobs/.test(url)) {
      return Promise.resolve({ data: { items: marketingJobs } });
    }
    if (/\/marketing\/(?:calendar|content)\/events/.test(url)) {
      const start = new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return Promise.resolve({
        data: {
          items: [
            {
              id: "evt-1",
              start: start.toISOString(),
              end: end.toISOString(),
              title: "Sugestão IG/FB #1",
              channel: "instagram",
            },
          ],
        },
      });
    }
    if (/^\/channels\/meta\/accounts\/[^/]+\/backfill\/status/.test(url)) {
      return Promise.resolve({ data: { last: null } });
    }
    if (/^\/channels\/meta\/accounts/.test(url)) {
      return Promise
        .resolve(originalGet(...args))
        .then((res) => {
          const items = Array.isArray(res?.data?.items) ? res.data.items : [];
          return { data: { items } };
        })
        .catch(() => ({ data: { items: [] } }));
    }
    if (/^\/settings\/google-calendar\/accounts/i.test(url)) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (/^\/settings\/instagram\/accounts/i.test(url)) {
      return Promise.resolve({ data: { items: [] } });
    }
  }
  return originalGet(...args);
}

function handlePost(...args) {
  const [url, body] = args;
  if (typeof url === "string") {
    if (/\/marketing\/content\/approve/.test(url) || /\/marketing\/calendar\/approve/.test(url)) {
      return Promise.resolve({ data: { ok: true, received: body || null } });
    }
  }
  return originalPost(...args);
}

api.get = jest.fn((...args) => handleGet(...args));
api.post = jest.fn((...args) => handlePost(...args));

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

