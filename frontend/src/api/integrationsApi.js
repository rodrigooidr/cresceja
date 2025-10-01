import inboxApi from '@/api/inboxApi';

export const getAllStatus = () =>
  inboxApi.get('/api/integrations/status').then((r) => r.data);

export const getProviderStatus = (provider) =>
  inboxApi.get(`/api/integrations/providers/${provider}`).then((r) => r.data);

export const connectProvider = (provider, payload) =>
  inboxApi.post(`/api/integrations/providers/${provider}/connect`, payload).then((r) => r.data);

export const subscribeProvider = (provider) =>
  inboxApi.post(`/api/integrations/providers/${provider}/subscribe`).then((r) => r.data);

export const testProvider = (provider, payload) =>
  inboxApi.post(`/api/integrations/providers/${provider}/test`, payload).then((r) => r.data);

export const disconnectProvider = (provider) =>
  inboxApi
    .post(`/api/integrations/providers/${provider}/disconnect`)
    .then((r) => r.data);

export const startBaileysQr = () =>
  inboxApi.post('/api/integrations/providers/whatsapp_session/qr/start').then((r) => r.data);

export const stopBaileysQr = () =>
  inboxApi.post('/api/integrations/providers/whatsapp_session/qr/stop').then((r) => r.data);

export const getBaileysSseToken = () =>
  inboxApi
    .post('/api/integrations/providers/whatsapp_session/qr/sse-token')
    .then((r) => r.data);

export const statusBaileys = () =>
  inboxApi.get('/api/integrations/providers/whatsapp_session/status').then((r) => r.data);

export const listEvents = ({ provider, limit, offset, start, end } = {}) => {
  const params = new URLSearchParams();
  if (provider) params.set('provider', provider);
  if (typeof limit === 'number') params.set('limit', String(limit));
  if (typeof offset === 'number') params.set('offset', String(offset));
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString();
  const url = query ? `/api/integrations/events?${query}` : '/api/integrations/events';
  return inboxApi.get(url).then((r) => r.data);
};

const integrationsApi = {
  getAllStatus,
  getProviderStatus,
  connectProvider,
  subscribeProvider,
  testProvider,
  disconnectProvider,
  startBaileysQr,
  stopBaileysQr,
  getBaileysSseToken,
  statusBaileys,
  listEvents,
};

export default integrationsApi;
