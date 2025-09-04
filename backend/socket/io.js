// backend/socket/io.js
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

function parseTokenFromHandshake(socket) {
  // 1) preferir o token enviado no handshake.auth (socket.io-client)
  let raw =
    socket.handshake?.auth?.token ||
    socket.handshake?.headers?.authorization ||
    '';

  if (!raw) return null;

  // aceita "Bearer xxx" ou só "xxx"
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m ? m[1] : raw;
}

export function initIO(httpServer, opts = {}) {
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  io = new IOServer(httpServer, {
    // CORS seguro (evita "*")
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
    // ajustes de estabilidade em redes instáveis
    pingInterval: 25000,
    pingTimeout: 20000,
    ...opts,
  });

  // 🔐 Auth middleware
  io.use((socket, next) => {
    try {
      const token = parseTokenFromHandshake(socket);
      if (!token) return next(new Error('missing token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload; // { id, email, org_id, ... } conforme seu JWT
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Diagnóstico opcional
    // console.log('🔌 connected', socket.id, 'user=', socket.user?.id);

    // ====== Convenções de sala ======
    // recomenda-se o front emitir "inbox:subscribe" ao abrir uma conversa
    socket.on('inbox:subscribe', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conv:${conversationId}`);
    });

    socket.on('inbox:unsubscribe', ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conv:${conversationId}`);
    });

    // ====== Typing indicators ======
    socket.on('typing:start', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        userId: socket.user?.id,
        conversationId,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        userId: socket.user?.id,
        conversationId,
      });
    });

    socket.on('disconnect', (reason) => {
      // console.log('❌ disconnected', socket.id, reason);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('io not initialized');
  return io;
}

/**
 * Helpers opcionais para emitir eventos do backend:
 *   emitMessageNew({ conversationId, message })
 *   emitConversationUpdate(conv)
 *   emitConversationNew(conv)
 */
export function emitMessageNew({ conversationId, message }) {
  if (!io || !conversationId || !message) return;
  io.to(`conv:${conversationId}`).emit('inbox:message:new', { conversation_id: conversationId, message });
}
export function emitConversationUpdate(conversation) {
  if (!io || !conversation?.id) return;
  io.emit('inbox:conversation:update', conversation);
}
export function emitConversationNew(conversation) {
  if (!io || !conversation?.id) return;
  io.emit('inbox:conversation:new', conversation);
}
