// backend/services/realtime.js
import { Server } from 'socket.io';
export let io;

export function attachIO(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', socket => {
    // client envia orgId e optionally conversationId para entrar nas rooms
    socket.on('join', ({ orgId, conversationId }) => {
      socket.join(`org:${orgId}`);
      if (conversationId) socket.join(`conv:${orgId}:${conversationId}`);
    });
    socket.on('leave', ({ orgId, conversationId }) => {
      if (orgId) socket.leave(`org:${orgId}`);
      if (conversationId) socket.leave(`conv:${orgId}:${conversationId}`);
    });
  });

  return io;
}
