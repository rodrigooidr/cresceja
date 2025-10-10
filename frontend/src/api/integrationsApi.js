import inboxApi from '@/api/inboxApi';

const unwrap = (response) => (response && typeof response === 'object' ? response.data ?? response : response);

export async function getAllStatus() {
  const res = await inboxApi.get('/integrations/status');
  return unwrap(res);
}

export async function subscribeProvider(provider) {
  const res = await inboxApi.post(`/integrations/providers/${provider}/subscribe`);
  return unwrap(res);
}

const WHATSAPP_KIND = 'whatsapp_session';

// helper genérico p/ fallback
async function withFallback(method, primaryPath, fallbackPath, ...args) {
  try {
    const response = await inboxApi[method](primaryPath, ...args);
    return unwrap(response);
  } catch (err) {
    const status = err?.response?.status || err?.status;
    if (status === 404) {
      const response = await inboxApi[method](fallbackPath, ...args);
      return unwrap(response);
    }
    throw err;
  }
}

export async function listEvents({ provider, limit, offset, start, end } = {}) {
  const params = new URLSearchParams();
  if (provider) params.set('provider', provider);
  if (typeof limit === 'number') params.set('limit', String(limit));
  if (typeof offset === 'number') params.set('offset', String(offset));
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString();
  const url = query ? `/integrations/events?${query}` : '/integrations/events';
  const res = await inboxApi.get(url);
  return unwrap(res);
}

// -------- WhatsApp Session (Baileys) --------
export async function getProviderStatus(kind) {
  if (String(kind ?? '') === WHATSAPP_KIND) {
    return withFallback(
      'get',
      `/integrations/providers/${kind}/status`,
      `/test-whatsapp/status`
    );
  }
  const res = await inboxApi.get(`/integrations/providers/${kind}`);
  return unwrap(res);
}

export async function connectProvider(kind, data) {
  if (String(kind ?? '') === WHATSAPP_KIND) {
    return withFallback('post', `/integrations/providers/${kind}/connect`, `/test-whatsapp/connect`, data || {});
  }
  const res = await inboxApi.post(`/integrations/providers/${kind}/connect`, data);
  return unwrap(res);
}

export async function testProvider(kind, data) {
  if (String(kind ?? '') === WHATSAPP_KIND) {
    return withFallback('post', `/integrations/providers/${kind}/test`, `/test-whatsapp/test`, data || {});
  }
  const res = await inboxApi.post(`/integrations/providers/${kind}/test`, data);
  return unwrap(res);
}

export async function disconnectProvider(kind) {
  // tenta POST disconnect e, se a API legacy usar DELETE, cai no fallback
  if (String(kind ?? '') === WHATSAPP_KIND) {
    try {
      const response = await inboxApi.post(`/integrations/providers/${kind}/disconnect`, {});
      return unwrap(response);
    } catch (err) {
      const status = err?.response?.status || err?.status;
      if (status === 404) {
        try {
          const legacyResponse = await inboxApi.post(`/test-whatsapp/disconnect`, {});
          return unwrap(legacyResponse);
        } catch (err2) {
          if ((err2?.response?.status || err2?.status) === 405) {
            const deleteResponse = await inboxApi.delete(`/test-whatsapp/disconnect`);
            return unwrap(deleteResponse);
          }
          throw err2;
        }
      }
      throw err;
    }
  }

  const res = await inboxApi.post(`/integrations/providers/${kind}/disconnect`);
  return unwrap(res);
}

// ---- QR flow (start/stop/status/token/stream) ----
export async function startBaileysQr() {
  return withFallback('post', `/integrations/providers/whatsapp_session/qr/start`, `/test-whatsapp/qr/start`, {});
}

export async function stopBaileysQr() {
  return withFallback('post', `/integrations/providers/whatsapp_session/qr/stop`, `/test-whatsapp/qr/stop`, {});
}

export async function statusBaileys() {
  return withFallback('get', `/integrations/providers/whatsapp_session/qr/status`, `/test-whatsapp/qr/status`);
}

export async function getBaileysSseToken() {
  // além do token, informamos qual streamPath deve ser usado
  try {
    const res = await inboxApi.get(`/api/integrations/providers/whatsapp_session/qr/token`);
    const data = unwrap(res) || {};
    return { token: data?.token, streamPath: `/api/integrations/providers/whatsapp_session/qr/stream` };
  } catch (err) {
    if ((err?.response?.status || err?.status) === 404) {
      const res2 = await inboxApi.get(`/api/test-whatsapp/qr/token`);
      const data2 = unwrap(res2) || {};
      return { token: data2?.token, streamPath: `/api/test-whatsapp/qr/stream` };
    }
    throw err;
  }
}

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
