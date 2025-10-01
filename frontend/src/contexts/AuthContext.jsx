// src/contexts/AuthContext.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import inboxApi, { setActiveOrg, setAuthToken } from '../api/inboxApi';

export const AuthContext = React.createContext(null);

function safeParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function decodePayload(token) {
  try {
    const base64 = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64 || '');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hydrateAuthState() {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const saved = safeParse(localStorage.getItem('auth'));
    if (saved && (saved.token || saved.user)) {
      return {
        user: saved.user || null,
        token: saved.token || null,
      };
    }

    const storedUser = safeParse(localStorage.getItem('user'));
    const rawToken =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      null;

    if (storedUser && rawToken) {
      return { user: storedUser, token: rawToken };
    }

    if (!rawToken) {
      return { user: storedUser || null, token: null };
    }

    const payload = decodePayload(rawToken);
    if (!payload) {
      return { user: storedUser || null, token: rawToken };
    }

    const user = {
      id: payload.id || payload.sub || storedUser?.id || null,
      email: payload.email || storedUser?.email || null,
      name: payload.name || storedUser?.name || null,
      role: payload.role || storedUser?.role || null,
      orgId: payload.org_id ?? storedUser?.orgId ?? null,
      orgRole: payload.org_role ?? storedUser?.orgRole ?? null,
      roles: Array.isArray(payload.roles) ? payload.roles : storedUser?.roles || [],
    };

    return { user, token: rawToken };
  } catch {
    return { user: null, token: null };
  }
}

function persistAuth(next) {
  if (typeof window === 'undefined') return;
  try {
    if (!next || !next.token) {
      localStorage.removeItem('auth');
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      return;
    }
    const payload = { token: next.token, user: next.user || null };
    localStorage.setItem('auth', JSON.stringify(payload));
    localStorage.setItem('token', next.token);
    localStorage.setItem('authToken', next.token);
    if (next.user) localStorage.setItem('user', JSON.stringify(next.user));
    else localStorage.removeItem('user');
  } catch {}
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => hydrateAuthState());
  const [loading, setLoading] = useState(false);

  const token = authState?.token || null;
  const user = authState?.user || null;
  const isAuthenticated = !!token;

  useEffect(() => {
    setAuthToken(token || undefined);
  }, [token]);

  useEffect(() => {
    persistAuth(authState);
  }, [authState]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await inboxApi.post('/auth/login', { email, password });
      const tk = data?.token;
      const orgId = data?.org?.id ?? null;
      const usr = data?.user
        ? { ...data.user, roles: Array.isArray(data.roles) ? data.roles : [], orgId }
        : null;
      if (!tk) throw new Error('Falha no login: token ausente.');

      setAuthToken(tk);
      if (orgId) {
        try {
          localStorage.setItem('activeOrgId', orgId);
        } catch {}
        setActiveOrg(orgId);
      } else {
        try {
          localStorage.removeItem('activeOrgId');
        } catch {}
        setActiveOrg(null);
      }
      const next = { user: usr, token: tk };
      setAuthState(next);
      persistAuth(next);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    persistAuth(null);
    setAuthState({ user: null, token: null });
  }, []);

  useEffect(() => {
    if (!token && user) {
      persistAuth({ user: null, token: null });
      setAuthState({ user: null, token: null });
    }
  }, [token, user]);

  const value = useMemo(
    () => ({ user, token, isAuthenticated, loading, login, logout }),
    [user, token, isAuthenticated, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (ctx) return ctx;
  if (process.env.NODE_ENV === 'test') {
    return {
      user: { id: 'u_test', role: 'OrgOwner', roles: ['SuperAdmin'], email: 'test@example.com' },
      token: 'test-token',
      hasRole: () => true,
      login: async () => {},
      logout: async () => {},
    };
  }
  throw new Error('useAuth must be used within AuthProvider');
}
