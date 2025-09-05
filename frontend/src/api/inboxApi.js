// src/api/inboxApi.js
import axios from "axios";

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:4000/api";

const inboxApi = axios.create({ baseURL: API_BASE_URL });

// aplica token existente (se houver) no boot
const bootToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
if (bootToken) {
  inboxApi.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
}

// request: anexa Authorization se houver token (não quebra sem token)
inboxApi.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response: trata 401 globalmente
inboxApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      try { localStorage.removeItem("token"); } catch {}
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// helpers de auth p/ AuthContext/Login
export function setAuthToken(token) {
  if (!token) return;
  try { localStorage.setItem("token", token); } catch {}
  inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAuthToken() {
  try { localStorage.removeItem("token"); } catch {}
  delete inboxApi.defaults.headers.common.Authorization;
}

export function getAuthToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

export default inboxApi;
