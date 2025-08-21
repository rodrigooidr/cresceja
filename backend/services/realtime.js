import { Server } from 'socket.io';
export let io;

export function attachIO(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  return io;
}
