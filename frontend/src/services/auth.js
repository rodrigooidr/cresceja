// src/services/auth.js
import inboxApi, { setActiveOrg } from "../api/inboxApi";

export function setToken(token) {
  if (typeof window !== "undefined") {
    if (!token) localStorage.removeItem('token');
    else localStorage.setItem('token', token);
  }
  // NÃO setar axios.defaults aqui; o interceptor já cuida por requisição.
}

export async function login(email, password) {
  const { data } = await inboxApi.post("/auth/login", { email, password });
  const { token, user, org, roles } = data || {};
  if (!token) throw new Error("Login sem token.");

  setToken(token);
  
  const orgId = org?.id ?? null;
  if (orgId) {
    localStorage.setItem('activeOrgId', orgId);
    setActiveOrg(orgId);
  } else {
    localStorage.removeItem('activeOrgId');
    setActiveOrg(null);
  }

  let me = user ? { ...user, roles: Array.isArray(roles) ? roles : [], orgId } : null;
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
  setToken(null);
  localStorage.removeItem("user");
}



