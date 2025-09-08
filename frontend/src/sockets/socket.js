import { io } from 'socket.io-client';
import { useOrg } from '../contexts/OrgContext';
import { useEffect, useMemo } from 'react';
import { API_BASE_URL, getAuthToken } from '../api/inboxApi';

function pickOriginFromApi(base) {
  try { return base.replace(/\/api\/?$/, ''); } catch { return base; }
}

export function makeSocket() {
  const origin = pickOriginFromApi(API_BASE_URL);
  const token = getAuthToken?.() || localStorage.getItem('token');
  return io(origin, { path: '/socket.io', auth: token ? { token } : undefined });
}

export function useSocket() {
  const { selected } = useOrg();
  const socket = useMemo(() => makeSocket(), []);

  useEffect(() => {
    if (selected) socket.emit('org:switch', { orgId: selected });
  }, [selected, socket]);

  return socket;
}

export default useSocket;
