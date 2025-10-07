// src/sockets/socket.js
import { useOrg } from '../contexts/OrgContext';
import { useEffect, useMemo } from 'react';
import { API_BASE_URL, getAuthToken } from '../api/inboxApi';
import { startSocketsSafe, getSocketUrl } from '../debug/installDebug';

// Retorna undefined para forçar same-origin quando base é relativo (ex.: "/api")
function pickOriginFromApi(base) {
  try {
    const origin = String(base || '').replace(/\/api\/?$/, '');
    return origin === '' || origin === '/' ? undefined : origin;
  } catch {
    return undefined;
  }
}

function resolveSocketUrl() {
  try {
    const helper = typeof getSocketUrl === 'function' ? getSocketUrl() : null;
    if (helper) return helper; // permite override em debug
  } catch {}
  return pickOriginFromApi(API_BASE_URL);
}

export function makeSocket() {
  const token = getAuthToken?.() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const url = resolveSocketUrl(); // ⬅️ faltava esta linha

  return startSocketsSafe({
    url,                       // undefined => same-origin (CRA proxy → :4000)
    path: '/socket.io',
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
  });
}

export function useSocket() {
  const { selected } = useOrg();
  const socket = useMemo(() => makeSocket(), []);

  useEffect(() => {
    if (selected && socket) socket.emit('org:switch', { orgId: selected });
  }, [selected, socket]);

  useEffect(() => () => {
    try {
      socket?.close?.();
      socket?.disconnect?.();
    } catch {}
  }, [socket]);

  return socket;
}

export default useSocket;
