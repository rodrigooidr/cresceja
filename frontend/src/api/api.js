// src/api/axios.js
import axios from "axios";

function normalizeBase(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// Prefixo fixo da API
const API_PREFIX = process.env.REACT_APP_API_PREFIX || "/api";

// ORIGIN opcional (prod ou quando quiser apontar para outro host)
const ORIGIN =
  process.env.REACT_APP_API_ORIGIN ||
  process.env.REACT_APP_API_URL || // compat
  "";

// Dev com CRA + proxy: ORIGIN vazio => baseURL = "/api"
// Prod (ou sem proxy): ORIGIN definido => baseURL = "<origin>/api"
const baseURL = ORIGIN ? normalizeBase(ORIGIN) + API_PREFIX : API_PREFIX;

const api = axios.create({
  baseURL,                 // dev: "/api" | prod: "https://.../api"
  withCredentials: false,  // usamos Bearer
  headers: { Accept: "application/json" },
});

// ---- Token helpers / interceptors ----
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
    localStorage.removeItem("token");
  }
}

axios.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  const acting = localStorage.getItem("actingUser");
  if (acting) config.headers["X-Acting-User"] = acting;
  if (config.data && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setAuthToken(null);
      localStorage.removeItem("user");
    }
    return Promise.reject(err);
  }
);

const bootToken = localStorage.getItem("token");
if (bootToken) setAuthToken(bootToken);

export default api;

