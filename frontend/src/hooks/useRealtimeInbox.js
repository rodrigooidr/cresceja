import { useEffect, useRef } from 'react';
import { startSocketsSafe } from '../debug/installDebug';
import escalationSound from '../assets/sounds/escalation.mp3';
import { getOrgIdFromStorage, getTokenFromStorage } from '../services/session.js';

export function useRealtimeInbox({ conversationId, onMessage, onConversation, onEscalation }) {
  const socketRef = useRef(null);
  const handlersRef = useRef({ onMessage, onConversation, onEscalation });

  useEffect(() => {
    handlersRef.current = { onMessage, onConversation, onEscalation };
  }, [onMessage, onConversation, onEscalation]);

  // cria a conexão apenas 1x
  useEffect(() => {
    const token = getTokenFromStorage();
    const socket = startSocketsSafe({
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
      auth: token ? { token } : undefined,
    });
    if (!socket) {
      socketRef.current = null;
      return () => {};
    }
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err?.message || err);
    });

    socket.on('conversation:new', (p) => handlersRef.current.onConversation?.(p));
    socket.on('message:new', (p) => handlersRef.current.onMessage?.(p));
    socket.on('alert:escalation', (p) => {
      try { new Audio(escalationSound).play(); } catch {}
      const h = handlersRef.current.onEscalation;
      if (h) h(p); else alert('Handoff solicitado');
    });

    return () => {
      try {
        socket.close?.();
        socket.disconnect?.();
      } catch {}
      socketRef.current = null;
    };
  }, []);

  // entrar nas salas quando a conversa mudar
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const orgId = getOrgIdFromStorage();
    if (!orgId) return;

    socket.emit('join', { orgId });
    if (conversationId) socket.emit('join', { orgId, conversationId });
  }, [conversationId]);
}
