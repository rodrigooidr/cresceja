// src/services/auth.js
import inboxApi from "../../api/inboxApi";


export async function login(email, password) {
  const { data } = await inboxApi.post("/auth/login", { email, password });
  const { token, user } = data || {};
  if (!token) throw new Error("Login sem token.");

  localStorage.setItem("token", token);
  inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;

  let me = user || null;
  if (!me) {
    try {
      const res = await inboxApi.get("/auth/me");
      me = res.data;
    } catch { me = null; }
  }
  if (me) localStorage.setItem("user", JSON.stringify(me));
  return { token, user: me };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  delete inboxApi.defaults.headers.common.Authorization;
}



