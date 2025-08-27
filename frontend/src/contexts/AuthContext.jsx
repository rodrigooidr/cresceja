// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import inboxApi, { setAuthToken } from '../api/inboxApi';

const AuthContext = createContext(null);

function safeParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => safeParse(localStorage.getItem('user')));
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);

  // Reaplica token no inboxApi da Inbox ao montar / ao mudar token
  useEffect(() => {
    setAuthToken(token || undefined);
  }, [token]);

  // Se não há token, zera o user “fantasma”
  useEffect(() => {
    if (!token && user) {
      localStorage.removeItem('user');
      setUser(null);
    }
  }, [token, user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // ATENÇÃO: baseURL já tem /api → então aqui é só '/auth/login'
      const { data } = await inboxApi.post('/auth/login', { email, password });

      const tk  = data?.token;
      const usr = data?.user ?? null;
      if (!tk) throw new Error('Falha no login: token ausente.');

      // injeta Authorization no cliente inboxApi e persiste
      setAuthToken(tk);
      localStorage.setItem('token', tk);
      setToken(tk);

      if (usr) {
        localStorage.setItem('user', JSON.stringify(usr));
        setUser(usr);
      }
      return true;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null); // remove Authorization do cliente
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
