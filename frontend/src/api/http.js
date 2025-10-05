// frontend/src/api/http.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const headers = config.headers || {};

  // Authorization
  try {
    const token = localStorage.getItem('token');
    if (token && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {}

  // X-Org-Id (prioriza orgId, senão activeOrg.id)
  try {
    const orgId = localStorage.getItem('orgId')
      || (JSON.parse(localStorage.getItem('activeOrg') || 'null')?.id);
    if (orgId && !headers['x-org-id'] && !headers['X-Org-Id']) {
      headers['x-org-id'] = orgId;
    }
  } catch {}

  config.headers = headers;
  return config;
});

export default api;
