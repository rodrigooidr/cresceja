// src/api/admin/orgsApi.js
// Rotas corretas: backend monta em /api/orgs (não /api/admin/orgs)
const BASE = '/api/orgs';

let httpClientPromise;
async function getHttpClient() {
  if (!httpClientPromise) {
    httpClientPromise = import('../inboxApi').then((module) => {
      const client =
        module?.default || module?.client || module?.api || module?.inboxApi;
      if (!client) throw new Error('HTTP client indisponível');
      return client;
    });
  }
  return httpClientPromise;
}

export async function listOrgs({ status, q, ...rest } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (rest && typeof rest === 'object') {
    Object.entries(rest).forEach(([key, value]) => {
      if (value == null) return;
      params.set(key, value);
    });
  }
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const http = await getHttpClient();
  const { data } = await http.get(url);
  return data;
}

export async function getOrg(id) {
  const http = await getHttpClient();
  const { data } = await http.get(`${BASE}/${id}`);
  return data;
}

export async function createOrg(payload) {
  const http = await getHttpClient();
  const { data } = await http.post(BASE, payload);
  return data;
}

export async function updateOrg(id, payload) {
  const http = await getHttpClient();
  const { data } = await http.patch(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteOrg(id) {
  const http = await getHttpClient();
  const { data } = await http.delete(`${BASE}/${id}`);
  return data;
}
