import inboxApi from './inboxApi';

export function connectWaCloud(payload) {
  return inboxApi.post('/integrations/whatsapp/cloud/connect', payload);
}

export function getWaCloudStatus() {
  return inboxApi.get('/integrations/whatsapp/cloud/status');
}

export function disconnectWaCloud() {
  return inboxApi.delete('/integrations/whatsapp/cloud/disconnect');
}

export function startWaSession() {
  return inboxApi.post('/integrations/whatsapp/session/start');
}

export function getWaSessionStatus() {
  return inboxApi.get('/integrations/whatsapp/session/status');
}

export function logoutWaSession() {
  return inboxApi.post('/integrations/whatsapp/session/logout');
}

export function getMetaPages() {
  return inboxApi.get('/integrations/meta/pages');
}

export function connectFacebook(page_id) {
  return inboxApi.post('/integrations/facebook/connect', { page_id });
}

export function getIgAccounts() {
  return inboxApi.get('/integrations/meta/ig-accounts');
}

export function connectInstagram(payload) {
  return inboxApi.post('/integrations/instagram/connect', payload);
}

export function getMetaOauthStartUrl() {
  return inboxApi.get('/integrations/meta/oauth/start');
}

export default {
  connectWaCloud,
  getWaCloudStatus,
  disconnectWaCloud,
  startWaSession,
  getWaSessionStatus,
  logoutWaSession,
  getMetaPages,
  connectFacebook,
  getIgAccounts,
  connectInstagram,
  getMetaOauthStartUrl,
};
