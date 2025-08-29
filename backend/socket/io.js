// backend/socket/io.js
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;
export function initIO(httpServer, opts = {}) {
  io = new IOServer(httpServer, {
    cors: { origin: '*'},
    path: '/socket.io',
    ...opts,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ','');
      if (!token) return next(new Error('missing token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      return next();
    } catch (e) {
      return next(e);
    }
  });

  io.on('connection', (socket) => {
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId: socket.user.id, conversationId });
    });
    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId: socket.user.id, conversationId });
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('io not initialized');
  return io;
}
