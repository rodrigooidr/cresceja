import { io } from 'socket.io-client';
import { API_BASE_URL } from 'api/inboxApi';

let socket = null;

export function makeSocket() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const apiOrigin = API_BASE_URL.replace(/\/api$/, '');
  socket = io(apiOrigin, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    // Se servidor exigir header:
    extraHeaders: { Authorization: `Bearer ${token}` },
  });

  return socket;
}

// Também exporta como default para cobrir imports legacy
export default makeSocket;

export function getSocket() {
  return socket;
}

export function __resetSocketForTests() {
  try {
    socket?.close?.();
    socket?.disconnect?.();
  } finally {
    socket = null;
  }
}
