import axios from 'axios';
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from "../api/api";

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
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete axios.defaults.headers.common.Authorization;
  }, [token]);

  // Evita “login fantasma”: se não há token, zera o user
  useEffect(() => {
    if (!token && user) {
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

      if (!tk) throw new Error('Falha no login: token ausente.');

      localStorage.setItem('token', tk);
      setToken(tk);

      if (usr != null) {
        localStorage.setItem('user', JSON.stringify(usr));
        setUser(usr);
      } else {
        // opcional: tentar /api/auth/me
        try {
          const r = await axios.get('/api/auth/me');
          localStorage.setItem('user', JSON.stringify(r.data));
          setUser(r.data);
        } catch {}
      }
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

  const isAuthenticated = !!token;

  const value = useMemo(
    () => ({ user, token, isAuthenticated, loading, login, logout }),
    [user, token, isAuthenticated, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

