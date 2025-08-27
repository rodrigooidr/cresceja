// src/api/inboxApi.js
import axios from 'axios';

// ---------------- Base URL ----------------
let baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:4000/api';

// remove barras finais; garante sufixo /api
baseURL = (baseURL || '').replace(/\/+$/, '');
if (!/\/api$/i.test(baseURL)) baseURL += '/api';

// ---------------- Axios instance ----------
const inboxApi = axios.create({
  baseURL,
  withCredentials: false,
  headers: { Accept: 'application/json' },
});

// ---------------- Helpers -----------------
export function setAuthToken(token) {
  if (token) {
    inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete inboxApi.defaults.headers.common.Authorization;
    localStorage.removeItem('token');
  }
}

/**
 * Monta URL absoluta para recursos/endpoints RELATIVOS à API.
 * Ex.: apiUrl('assets/123') -> http://host:port/api/assets/123
 *      apiUrl('/assets/123') -> http://host:port/api/assets/123
 *      apiUrl('') -> base da API (http://host:port/api)
 * Mantém http(s) absolutos como vierem.
 */
export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (inboxApi.defaults.baseURL || '').replace(/\/+$/, '');
  const rel = String(path || '').replace(/^\/+/, '');
  return rel ? `${base}/${rel}` : base;
}

// reaplica token salvo (F5 etc.)
setAuthToken(localStorage.getItem('token') || undefined);

// --------------- Interceptors ------------
inboxApi.interceptors.request.use((config) => {
  // injeta token se ainda não estiver
  const token = localStorage.getItem('token');
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // evita prefixo /api duplicado
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
    if (err?.response?.status === 401) {
      setAuthToken(undefined);
      localStorage.removeItem('user');
    }
    if (err?.response?.status === 404 && process.env.NODE_ENV !== 'production') {
      console.warn('[inboxApi] 404 em', err?.config?.url, 'baseURL=', baseURL);
    }
    return Promise.reject(err);
  }
);

// exports
export default inboxApi;
export { inboxApi };
