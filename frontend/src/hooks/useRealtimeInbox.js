import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import escalationSound from '../assets/sounds/escalation.mp3';
import { useOrg } from '../contexts/OrgContext';

export function useRealtimeInbox({ conversationId, onMessage, onConversation, onEscalation }) {
  const socketRef = useRef(null);
  const handlersRef = useRef({ onMessage, onConversation, onEscalation });
  const { selected } = useOrg();

  useEffect(() => {
    handlersRef.current = { onMessage, onConversation, onEscalation };
  }, [onMessage, onConversation, onEscalation]);

  // cria a conexão apenas 1x
  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
    });
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

    return () => { try { socket.disconnect(); } catch {} socketRef.current = null; };
  }, []);

  // entrar nas salas quando a conversa mudar
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selected) return;
    socket.emit('org:switch', { orgId: selected });
    if (conversationId) socket.emit('join', { orgId: selected, conversationId });
  }, [conversationId, selected]);
}
