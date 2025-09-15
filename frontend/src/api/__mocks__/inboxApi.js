// Bridge mock que reexporta utilitários e named exports
// garantindo compatibilidade com importações diretas de `src/api/inboxApi`
import api, {
  __mockRoute, __resetMockApi, __getLastRequest, __setFeatures, __setLimits,
  searchOrgs, searchClients, getPlanFeatures, savePlanFeatures,
} from "./index";

api.__mockRoute = __mockRoute;
api.__resetMockApi = __resetMockApi;
api.__getLastRequest = __getLastRequest;
api.__setFeatures = __setFeatures;
api.__setLimits = __setLimits;

export default api;
export {
  __mockRoute, __resetMockApi, __getLastRequest, __setFeatures, __setLimits,
  searchOrgs, searchClients, getPlanFeatures, savePlanFeatures,
};

