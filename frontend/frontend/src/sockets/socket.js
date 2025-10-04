import { useOrg } from '../contexts/OrgContext';
import { useEffect, useMemo } from 'react';
import { API_BASE_URL, getAuthToken } from '../api/inboxApi';
import { startSocketsSafe, getSocketUrl } from '../debug/installDebug';

function pickOriginFromApi(base) {
  try { return base.replace(/\/api\/?$/, ''); } catch { return base; }
}

function resolveSocketUrl() {
  try {
    const helper = typeof getSocketUrl === 'function' ? getSocketUrl() : null;
    if (helper) return helper;
  } catch {}
  return pickOriginFromApi(API_BASE_URL);
}

export function makeSocket() {
  const token = getAuthToken?.() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  return startSocketsSafe({
    url: resolveSocketUrl(),
    path: '/socket.io',
    auth: token ? { token } : undefined,
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
