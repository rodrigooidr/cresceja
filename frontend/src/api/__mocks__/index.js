import { applyOrgIdHeader } from "../orgHeader.js";

let __lastRequest = null;

const __state = {
  org: {
    id: "org_test",
    name: "Org Test",
    features: { calendar: true, facebook: true, instagram: true, whatsapp: true },
    plan: { limits: { calendar: 1, facebook_pages: 1, instagram_accounts: 1, wa_numbers: 1 } },
  },
};

export function __setFeatures(next = {}) {
  __state.org.features = { ...__state.org.features, ...next };
}
export function __setLimits(next = {}) {
  __state.org.plan.limits = { ...__state.org.plan.limits, ...next };
}
export function __setOrg(partial = {}) {
  __state.org = { ...__state.org, ...partial };
}

function buildFeaturesResponse() {
  const { features, plan: { limits } } = __state.org;
  return {
    google_calendar_accounts: { enabled: !!features.calendar, limit: limits.calendar, used: 0 },
    facebook_pages: { enabled: !!features.facebook, limit: limits.facebook_pages, used: 0 },
    instagram_accounts: { enabled: !!features.instagram, limit: limits.instagram_accounts, used: 0 },
    whatsapp_numbers: { enabled: !!features.whatsapp, limit: limits.wa_numbers, used: 0 },
  };
}

export function __getLastRequest() {
  return __lastRequest;
}

const api = {
  get: jest.fn(async (url, config = {}) => {
    const headers = applyOrgIdHeader({ ...(config.headers || {}) });
    __lastRequest = { method: "get", url, headers };
    if (url.includes('/orgs/current')) return { data: __state.org };
    if (url.includes('/plans/current')) return { data: __state.org.plan };
    if (/\/orgs\/[^/]+\/features$/.test(url)) return { data: buildFeaturesResponse() };
    if (url.includes('/calendar/accounts')) return { data: [] };
    if (url.includes('/facebook/pages')) return { data: [] };
    if (url.includes('/instagram/accounts')) return { data: [] };
    return { data: {} };
  }),
  post: jest.fn(async (url, body, config = {}) => {
    const headers = applyOrgIdHeader({ ...(config.headers || {}) });
    __lastRequest = { method: "post", url, body, headers };
    return { data: {} };
  }),
  patch: jest.fn(async (url, body, config = {}) => {
    const headers = applyOrgIdHeader({ ...(config.headers || {}) });
    __lastRequest = { method: "patch", url, body, headers };
    return { data: {} };
  }),
  delete: jest.fn(async (url, config = {}) => {
    const headers = applyOrgIdHeader({ ...(config.headers || {}) });
    __lastRequest = { method: "delete", url, headers };
    return { data: {} };
  }),
  defaults: { headers: { common: {} } },
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
};

export default api;
export const setActiveOrg = () => {};
