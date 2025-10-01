// src/services/auth.js
import inboxApi, { setActiveOrg } from "../../api/inboxApi";


export async function login(email, password) {
  const { data } = await inboxApi.post("/auth/login", { email, password });
  const { token, user, org, roles } = data || {};
  if (!token) throw new Error("Login sem token.");

  localStorage.setItem("token", token);
  inboxApi.defaults.headers.common.Authorization = `Bearer ${token}`;

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
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  delete inboxApi.defaults.headers.common.Authorization;
}



