import { useEffect } from 'react';
import inboxApi from '../../../api/inboxApi';
import { startSocketsSafe } from '../../../debug/installDebug';

const apiWsUrl = (path = '/') => {
  try {
    const base = (inboxApi?.defaults?.baseURL || '').replace(/\/api\/?$/, '');
    const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!origin) return path;
    const u = new URL(origin);
    return `${u.origin}${path}`;
  } catch {
    return path;
  }
};

const createSocket = () =>
  startSocketsSafe({
    url: apiWsUrl('/socket.io'),
    path: '/socket.io',
    withCredentials: true,
  });

export default function useRealtime({ selRef, onNewMessage, onUpdateMessage, onConversationUpdated, onTyping }) {
  useEffect(() => {
    const s = createSocket();
    if (!s) return () => {};

    const onConnect = () => {};
    const onDisconnect = () => {};

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (onNewMessage) s.on('message:new', onNewMessage);
    if (onUpdateMessage) s.on('message:updated', onUpdateMessage);
    if (onConversationUpdated) s.on('conversation:updated', onConversationUpdated);
    if (onTyping) {
      s.on('typing', onTyping);
      s.on('message:typing', onTyping);
    }

    return () => {
      s.off?.('connect', onConnect);
      s.off?.('disconnect', onDisconnect);
      if (onNewMessage) s.off?.('message:new', onNewMessage);
      if (onUpdateMessage) s.off?.('message:updated', onUpdateMessage);
      if (onConversationUpdated) s.off?.('conversation:updated', onConversationUpdated);
      if (onTyping) {
        s.off?.('typing', onTyping);
        s.off?.('message:typing', onTyping);
      }
      try { s.disconnect(); } catch {}
    };
  }, [selRef, onNewMessage, onUpdateMessage, onConversationUpdated, onTyping]);
}
