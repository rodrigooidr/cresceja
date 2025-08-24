// src/setupAxios.js
import axios from "axios";

function normalizeBase(url) { return !url ? "" : (url.endsWith("/") ? url.slice(0, -1) : url); }
const API_PREFIX = process.env.REACT_APP_API_PREFIX || "/api";
const ORIGIN =
  process.env.REACT_APP_API_ORIGIN ||
  process.env.REACT_APP_API_URL || "";

axios.defaults.baseURL = ORIGIN ? normalizeBase(ORIGIN) + API_PREFIX : API_PREFIX;
axios.defaults.headers.common.Accept = "application/json";

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const acting = localStorage.getItem("actingUser");
  if (acting) config.headers["X-Acting-User"] = acting;
  if (config.data && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

axios.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      delete axios.defaults.headers.common.Authorization;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(err);
  }
);
