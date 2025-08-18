// src/api/api.js
import axios from "axios";

function normalizeBase(url) {
  if (!url) return "";
  // remove barra final para evitar // quando o path começa com /api
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const baseURL = normalizeBase(process.env.REACT_APP_API_URL || ""); 
// Observação:
// - Se usar CRA proxy no package.json: "proxy": "http://localhost:4000", mantenha baseURL = "".
// - Se quiser apontar direto para a API: REACT_APP_API_URL="http://localhost:4000".

const api = axios.create({
  baseURL,
  withCredentials: false, // usamos Bearer token, não cookies
  headers: {
    Accept: "application/json",
  },
});

// ---- Token helpers (opcional mas útil) ----
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("token");
  }
}

// Injeta Authorization a cada request com base no localStorage (fallback)
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // Conteúdo JSON por padrão quando há body
  if (config.data && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

// Trata 401: limpa sessão (ou redireciona, se preferir)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // limpa tudo relacionado a auth
      setAuthToken(null);
      localStorage.removeItem("user");
      // se quiser, redirecione:
      // if (window.location.pathname !== "/login") window.location.replace("/login");
    }
    return Promise.reject(err);
  }
);

// Garante header se já havia token ao carregar o app
const bootToken = localStorage.getItem("token");
if (bootToken) setAuthToken(bootToken);

export default api;
