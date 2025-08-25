import { io } from 'socket.io-client';
const URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
export function makeSocket() {
  const token = localStorage.getItem('token');
  return io(URL, { auth: { token } });
}
