import inboxApi from 'api/inboxApi';

const cfg = (orgId) => (orgId ? { headers: { 'X-Org-Id': orgId } } : {});

export const waCloud = {
  status: ({ orgId } = {}) => inboxApi.get('/integrations/whatsapp/cloud/status', cfg(orgId)),
  connect: ({ orgId, ...body }) => inboxApi.post('/integrations/whatsapp/cloud/connect', body, cfg(orgId)),
  disconnect: ({ orgId } = {}) => inboxApi.post('/integrations/whatsapp/cloud/disconnect', {}, cfg(orgId)),
  webhookCheck: ({ orgId } = {}) => inboxApi.get('/integrations/whatsapp/cloud/webhook-check', cfg(orgId)),
  sendTest: ({ to, orgId }) => inboxApi.post('/integrations/whatsapp/cloud/send-test', { to }, cfg(orgId)),
};

export const waSession = {
  status: ({ orgId } = {}) => inboxApi.get('/integrations/whatsapp/session/status', cfg(orgId)),
  start: ({ orgId } = {}) => inboxApi.post('/integrations/whatsapp/session/start', {}, cfg(orgId)),
  logout: ({ orgId } = {}) => inboxApi.post('/integrations/whatsapp/session/logout', {}, cfg(orgId)),
  test: ({ orgId } = {}) => inboxApi.get('/integrations/whatsapp/session/test', cfg(orgId)),
};

export const meta = {
  webhookCheck: ({ orgId } = {}) => inboxApi.get('/integrations/meta/webhook-check', cfg(orgId)),
  fb: {
    connect: ({ orgId, ...body }) => inboxApi.post('/integrations/meta/facebook/connect', body, cfg(orgId)),
    status: ({ orgId } = {}) => inboxApi.get('/integrations/meta/facebook/status', cfg(orgId)),
    pages: ({ orgId } = {}) => inboxApi.get('/integrations/meta/pages', cfg(orgId)),
    test: ({ orgId } = {}) => inboxApi.get('/integrations/meta/facebook/test', cfg(orgId)),
  },
  ig: {
    connect: ({ orgId, ...body }) => inboxApi.post('/integrations/meta/instagram/connect', body, cfg(orgId)),
    status: ({ orgId } = {}) => inboxApi.get('/integrations/meta/instagram/status', cfg(orgId)),
    accounts: ({ orgId } = {}) => inboxApi.get('/integrations/meta/ig-accounts', cfg(orgId)),
    test: ({ orgId } = {}) => inboxApi.get('/integrations/meta/instagram/test', cfg(orgId)),
  },
};

export const gcal = {
  oauthStart: ({ orgId } = {}) => inboxApi.get('/integrations/google/calendar/oauth/start', cfg(orgId)),
  status: ({ orgId } = {}) => inboxApi.get('/integrations/google/calendar/status', cfg(orgId)),
  calendars: ({ orgId } = {}) => inboxApi.get('/integrations/google/calendar/calendars', cfg(orgId)),
  events: ({ orgId, ...body }) => inboxApi.post('/integrations/google/calendar/events', body, cfg(orgId)),
  disconnect: ({ orgId } = {}) => inboxApi.post('/integrations/google/calendar/disconnect', {}, cfg(orgId)),
};
