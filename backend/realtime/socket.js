// backend/realtime/socket.js
import { Server } from 'socket.io';

function parseOrigins() {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

export function initSocket(server) {
  if (server.__io) return server.__io; // evita init duplo

  const io = new Server(server, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    cors: {
      origin: parseOrigins(),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // eventos mínimos de sanidade
    socket.emit('hello', { ok: true, ts: Date.now() });
    socket.on('ping', () => socket.emit('pong'));
  });

  server.__io = io;
  return io;
}
