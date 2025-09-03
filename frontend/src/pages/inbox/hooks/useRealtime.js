// src/pages/inbox/hooks/useRealtime.js
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import inboxApi from '../../../api/inboxApi';


const apiWsUrl = (path = '/') => {
const base = (inboxApi?.defaults?.baseURL || '').replace(/\/api\/?$/, '');
const u = new URL(base || window.location.origin);
u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
return `${u.origin}${path}`;
};
const createSocket = () => io(apiWsUrl('/socket.io'), { path: '/socket.io', withCredentials: true });


export default function useRealtime({ selRef, onNewMessage, onUpdateMessage, onConversationUpdated, onTyping }) {
useEffect(() => {
const s = createSocket();


const onConnect = () => { /* opcional: setConnected(true) via callback */ };
const onDisconnect = () => { /* opcional */ };


s.on('connect', onConnect);
s.on('disconnect', onDisconnect);
s.on('message:new', onNewMessage);
s.on('message:updated', onUpdateMessage);
s.on('conversation:updated', onConversationUpdated);
s.on('typing', onTyping);
s.on('message:typing', onTyping);


return () => {
s.off('connect', onConnect);
s.off('disconnect', onDisconnect);
s.off('message:new', onNewMessage);
s.off('message:updated', onUpdateMessage);
s.off('conversation:updated', onConversationUpdated);
s.off('typing', onTyping);
s.off('message:typing', onTyping);
s.disconnect();
};
}, [selRef, onNewMessage, onUpdateMessage, onConversationUpdated, onTyping]);
}