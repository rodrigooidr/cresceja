// src/services/auth.js
import inboxApi, { setActiveOrg, setAuthToken } from "../../api/inboxApi";


export async function login(email, password) {
  const { data } = await inboxApi.post("/auth/login", { email, password });
  const { token, user, org, roles } = data || {};
  if (!token) throw new Error("Login sem token.");

  setAuthToken(token);
  // não fixe no default; o interceptor já injeta por requisição

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
  setAuthToken(null);
  localStorage.removeItem("user");
}



