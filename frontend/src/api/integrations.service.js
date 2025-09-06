// frontend/src/api/integrations.service.js
// Serviço único para integrações (WhatsApp Cloud/Session, Facebook, Instagram)
// Mantém apenas chamadas HTTP; NÃO altera layout nem componentes.
import inboxApi from 'api/inboxApi';

// ---------------- WhatsApp Cloud (API) ----------------
export async function getWaCloudStatus() {
  const { data } = await inboxApi.get('/integrations/whatsapp/cloud/status');
  return data;
}
export async function connectWaCloud(payload) {
  // payload: { phone_number_id, waba_id, access_token, verify_token }
  const { data } = await inboxApi.post('/integrations/whatsapp/cloud/connect', payload);
  return data;
}
export async function disconnectWaCloud() {
  const { data } = await inboxApi.delete('/integrations/whatsapp/cloud/disconnect');
  return data;
}

// ---------------- WhatsApp Session (QR) ----------------
export async function startWaSession() {
  const { data } = await inboxApi.post('/integrations/whatsapp/session/start');
  return data;
}
export async function getWaSessionStatus() {
  const { data } = await inboxApi.get('/integrations/whatsapp/session/status');
  return data;
}
export async function logoutWaSession() {
  const { data } = await inboxApi.post('/integrations/whatsapp/session/logout');
  return data;
}

// ---------------- Meta OAuth helpers ----------------
export function getMetaOauthStartUrl() {
  // Endpoint que inicia o fluxo OAuth no backend
  return '/api/integrations/meta/oauth/start';
}

// ---------------- Facebook (Pages/Messenger) ----------------
export async function getMetaPages() {
  // Lista páginas disponíveis do usuário/autorização atual
  const { data } = await inboxApi.get('/integrations/meta/pages');
  // Esperado: { items: [{id, name, connected?: boolean}], ... }
  return data;
}
export async function connectFacebook(page_id) {
  const { data } = await inboxApi.post('/integrations/facebook/connect', { page_id });
  return data;
}
export async function getFacebookStatus() {
  // Opcional: se o backend expõe um status dedicado
  try {
    const { data } = await inboxApi.get('/integrations/facebook/status');
    return data;
  } catch {
    // fallback: derive por pages()
    const pages = await getMetaPages().catch(() => ({ items: [] }));
    const connected = Array.isArray(pages?.items) && pages.items.some(p => p?.connected);
    return { status: connected ? 'connected' : 'disconnected' };
  }
}
export async function disconnectFacebook() {
  // Caso exista um endpoint dedicado; se não, pode limpar seleção no channels
  try {
    const { data } = await inboxApi.delete('/integrations/facebook/disconnect');
    return data;
  } catch (e) {
    // manter compatibilidade com back parcial
    return { ok: true };
  }
}

// ---------------- Instagram (IG business / DMs) ----------------
export async function getIgAccounts() {
  const { data } = await inboxApi.get('/integrations/meta/ig-accounts');
  // Esperado: { items: [{id, username, page_id, connected?: boolean}], ... }
  return data;
}
export async function connectInstagram({ ig_id, page_id }) {
  const { data } = await inboxApi.post('/integrations/instagram/connect', { ig_id, page_id });
  return data;
}
export async function getInstagramStatus() {
  try {
    const { data } = await inboxApi.get('/integrations/instagram/status');
    return data;
  } catch {
    const ig = await getIgAccounts().catch(() => ({ items: [] }));
    const connected = Array.isArray(ig?.items) && ig.items.some(a => a?.connected);
    return { status: connected ? 'connected' : 'disconnected' };
  }
}
export async function disconnectInstagram() {
  try {
    const { data } = await inboxApi.delete('/integrations/instagram/disconnect');
    return data;
  } catch {
    return { ok: true };
  }
}

// ---------------- Utilidades de ajuda (opcionais) ----------------
export function redacted(s, keep = 4) {
  if (!s) return '';
  const str = String(s);
  if (str.length <= keep) return '*'.repeat(str.length);
  return `${str.slice(0, keep)}${'*'.repeat(Math.max(0, str.length - keep))}`;
}
