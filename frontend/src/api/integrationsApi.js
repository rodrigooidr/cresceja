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
  inboxApi.delete(`/api/integrations/providers/${provider}`).then((r) => r.data);

export default {
  getAllStatus,
  getProviderStatus,
  connectProvider,
  subscribeProvider,
  testProvider,
  disconnectProvider,
};
