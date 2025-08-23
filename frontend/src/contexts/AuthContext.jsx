// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

function safeParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem('user')));
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);

  // Propaga/limpa Authorization no axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  // ✅ Se não há token mas existe "user" antigo no storage, limpa para evitar "login fantasma"
  useEffect(() => {
    if (!token && user) {
      console.warn('Empty token! Limpando usuário em memória.');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, [token, user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      const tk = data?.token || null;
      const usr = data?.user ?? null;

      if (tk) localStorage.setItem('token', tk); else localStorage.removeItem('token');
      if (usr !== null) localStorage.setItem('user', JSON.stringify(usr)); else localStorage.removeItem('user');

      setToken(tk);
      setUser(usr);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
