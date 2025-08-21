import { useEffect } from 'react';
import { io } from 'socket.io-client';
import escalationSound from '../assets/sounds/escalation.mp3';

export function useRealtimeInbox({ conversationId, onMessage, onConversation, onEscalation }) {
  useEffect(() => {
    const socket = io();
    const orgId = localStorage.getItem('org_id');
    if (orgId) socket.emit('join', `org:${orgId}`);
    if (conversationId && orgId) socket.emit('join', `conv:${orgId}:${conversationId}`);
    socket.on('conversation:new', (p) => onConversation && onConversation(p));
    socket.on('message:new', (p) => onMessage && onMessage(p));
    socket.on('alert:escalation', (p) => {
      const audio = new Audio(escalationSound);
      audio.play().catch(() => {});
      if (onEscalation) onEscalation(p);
      else alert('Handoff solicitado');
    });
    return () => socket.disconnect();
  }, [conversationId, onMessage, onConversation, onEscalation]);
}
