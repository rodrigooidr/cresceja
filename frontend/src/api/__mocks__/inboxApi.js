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

// Clona a referência para manter a implementação original
const api = { ...apiBase };

// Envolva os métodos HTTP em jest.fn para suportar .mockImplementation no teste
for (const m of ["get", "post", "put", "patch", "delete"]) {
  const orig = apiBase[m];
  api[m] = jest.fn((...args) => orig(...args));
}

// (opcional) se seu código usa interceptors, mantenha um stub seguro
api.interceptors = api.interceptors || { request: { use: () => {} } };

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

