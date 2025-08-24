// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

function safeParse(json, fallback = null) {
  try { return JSON.parse(json); } catch { return fallback; }
}
function normalizeToken(t) {
  if (!t) return null;
  const s = String(t).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  return s;
}

export function AuthProvider({ children }) {
  // bootstrap do storage (defensivo)
  const [token, setToken] = useState(() => normalizeToken(localStorage.getItem('token')));
  const [user,  setUser]  = useState(() => safeParse(localStorage.getItem('user')) || null);
  const [loading, setLoading] = useState(false);

  // sempre que token mudar, propaga/limpa no axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
      // sem token => não considerar usuário válido
      if (user) {
        localStorage.removeItem('user');
        setUser(null);
      }
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSession = (tk, usr) => {
    const ntk = normalizeToken(tk);
    if (ntk) localStorage.setItem('token', ntk); else localStorage.removeItem('token');
    if (usr) localStorage.setItem('user', JSON.stringify(usr)); else localStorage.removeItem('user');
    setToken(ntk);
    setUser(usr || null);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      setSession(data?.token || null, data?.user || null);
      return Boolean(data?.token && data?.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => setSession(null, null);

  // auth “verdadeiro” só com token + user
  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({ user, token, loading, isAuthenticated, login, logout }),
    [user, token, loading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
