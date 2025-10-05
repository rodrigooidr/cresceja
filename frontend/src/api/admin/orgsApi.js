// src/api/admin/orgsApi.js
// O http já tem baseURL '/api' -> aqui use apenas '/orgs'
import http from '@/api/http'; // ajuste o caminho se seu http estiver em outro local

const BASE = '/orgs';

export async function listOrgs({ status, q } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await http.get(url);
  return data;
}

export async function getOrg(id) {
  const { data } = await http.get(`${BASE}/${id}`);
  return data;
}

export async function createOrg(payload) {
  const { data } = await http.post(BASE, payload);
  return data;
}

export async function updateOrg(id, payload) {
  const { data } = await http.patch(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteOrg(id) {
  const { data } = await http.delete(`${BASE}/${id}`);
  return data;
}
