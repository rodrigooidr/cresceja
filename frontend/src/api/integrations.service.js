import inboxApi from 'api/inboxApi';

export const waCloud = {
  status: () => inboxApi.get('/integrations/whatsapp/cloud/status'),
  connect: (body) => inboxApi.post('/integrations/whatsapp/cloud/connect', body),
  disconnect: () => inboxApi.post('/integrations/whatsapp/cloud/disconnect'),
  webhookCheck: () => inboxApi.get('/integrations/whatsapp/cloud/webhook-check'),
  sendTest: (to) => inboxApi.post('/integrations/whatsapp/cloud/send-test', { to }),
};

export const waSession = {
  status: () => inboxApi.get('/integrations/whatsapp/session/status'),
  start: () => inboxApi.post('/integrations/whatsapp/session/start'),
  logout: () => inboxApi.post('/integrations/whatsapp/session/logout'),
  test: () => inboxApi.get('/integrations/whatsapp/session/test'),
};

export const meta = {
  webhookCheck: () => inboxApi.get('/integrations/meta/webhook-check'),
  fb: {
    connect: (body) => inboxApi.post('/integrations/meta/facebook/connect', body),
    status: () => inboxApi.get('/integrations/meta/facebook/status'),
    pages: () => inboxApi.get('/integrations/meta/pages'),
    test: () => inboxApi.get('/integrations/meta/facebook/test'),
  },
  ig: {
    connect: (body) => inboxApi.post('/integrations/meta/instagram/connect', body),
    status: () => inboxApi.get('/integrations/meta/instagram/status'),
    accounts: () => inboxApi.get('/integrations/meta/ig-accounts'),
    test: () => inboxApi.get('/integrations/meta/instagram/test'),
  },
};

export const gcal = {
  oauthStart: () => inboxApi.get('/integrations/google/calendar/oauth/start'),
  status: () => inboxApi.get('/integrations/google/calendar/status'),
  calendars: () => inboxApi.get('/integrations/google/calendar/calendars'),
  events: (body) => inboxApi.post('/integrations/google/calendar/events', body),
  disconnect: () => inboxApi.post('/integrations/google/calendar/disconnect'),
};
