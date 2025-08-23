import { Server } from 'socket.io';
export let io;

export function attachIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    socket.on('join', (payload) => {
      let orgId, conversationId;

      if (typeof payload === 'string') {
        // suporte legado: "org:ORG" ou "conv:ORG:CONV"
        const [tag, a, b] = payload.split(':');
        if (tag === 'org' && a) orgId = a;
        if (tag === 'conv' && a && b) { orgId = a; conversationId = b; }
      } else if (payload && typeof payload === 'object') {
        ({ orgId, conversationId } = payload);
      }

      if (!orgId) return; // não entra em salas inválidas
      socket.join(`org:${orgId}`);
      if (conversationId) socket.join(`conv:${orgId}:${conversationId}`);
    });

    socket.on('leave', (payload) => {
      let orgId, conversationId;

      if (typeof payload === 'string') {
        const [tag, a, b] = payload.split(':');
        if (tag === 'org' && a) orgId = a;
        if (tag === 'conv' && a && b) { orgId = a; conversationId = b; }
      } else if (payload && typeof payload === 'object') {
        ({ orgId, conversationId } = payload);
      }

      if (orgId) socket.leave(`org:${orgId}`);
      if (orgId && conversationId) socket.leave(`conv:${orgId}:${conversationId}`);
    });
  });

  return io;
}
