// src/services/auth.js
import api from "../api/api";

export async function login(email, password) {
  const { data } = await api.post("/api/auth/login", { email, password });
  const { token, user } = data || {};
  if (!token) throw new Error("Login sem token.");

  localStorage.setItem("token", token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;

  let me = user || null;
  if (!me) {
    try {
      const res = await api.get("/api/auth/me");
      me = res.data;
    } catch { me = null; }
  }
  if (me) localStorage.setItem("user", JSON.stringify(me));
  return { token, user: me };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  delete api.defaults.headers.common.Authorization;
}
