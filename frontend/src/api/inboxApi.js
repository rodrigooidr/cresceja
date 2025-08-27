// src/api/inboxApi.js
import axios from 'axios';

let baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:4000/api';

// saneia: remove barra final e garante 1 único /api
baseURL = baseURL.replace(/\/+$/, '');
if (!/\/api$/.test(baseURL)) baseURL = `${baseURL}/api`;

const inboxApi = axios.create({
  baseURL,
  withCredentials: false,
});

// monta URL absoluta baseada na base da API, útil para href/src de assets
export function apiUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const root = baseURL.replace(/\/api$/, '');
  return root + (path.startsWith('/') ? path : `/${path}`);
}

// helper para token
export function setAuthToken(token) {
  if (token) {
    inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete inboxApi.defaults.headers.common.Authorization;
    localStorage.removeItem('token');
  }
}

// Gera URL absoluta com base no baseURL (que já inclui /api)
export function apiUrl(path = "") {
  const base = (inboxApi.defaults.baseURL || "").replace(/\/+$/, ""); // sem barra final
  const rel = String(path || "").replace(/^\/+/, "");                 // sem barra inicial
  return `${base}/${rel}`;
}

// reaplica token ao carregar
setAuthToken(localStorage.getItem('token') || undefined);

// interceptor: injeta token e remove '/api/' duplicado
inboxApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (typeof config.url === 'string') {
    if (config.url.startsWith('/api/')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[inboxApi] Removendo prefixo "/api" duplicado de', config.url);
      }
      config.url = config.url.replace(/^\/api\//, '/');
    }
    config.url = config.url.replace(/^\/+/, '/');
  }
  return config;
});

inboxApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 404 && process.env.NODE_ENV !== 'production') {
      console.warn('[inboxApi] 404 em', err?.config?.url, 'baseURL=', baseURL);
    }
    return Promise.reject(err);
  }
);

// ✅ exportações finais
export default inboxApi;
export { inboxApi };
