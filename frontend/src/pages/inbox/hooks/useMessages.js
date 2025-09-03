// src/pages/inbox/hooks/useMessages.js
}


const send = useCallback(async () => {
if (!sel) return;
// sobe anexos locais
const uploadedNow = await uploadLocalAttachments(sel.id);
const ready = [...attachments.filter(a => !a.error && !a.localFile && a.id), ...uploadedNow];


let payload = null;
if (ready.length) payload = { type: 'file', attachments: ready.map(a => a.id) };
else if (text.trim()) payload = { type: 'text', text: text.trim() };
if (!payload) return;


const tempId = `temp:${Date.now()}:${Math.random()}`;
const base = normalizeMessage({ id: tempId, temp_id: tempId, type: payload.type||'text', text: payload.text||'', is_outbound: true, from: 'agent', attachments: ready.map(a=>({ id:a.id, url:a.url, thumb_url:a.thumb_url, filename:a.filename, mime:a.mime })), created_at: new Date().toISOString() });
setMsgs(prev => [...(prev||[]), { ...base, sending: true }]);


try {
const res = await postMessageWithFallback(sel.id, payload, tempId);
const created = normalizeMessage(res?.data?.message ?? res?.data?.data ?? res?.data);
if (created) {
setMsgs(p => p.map(m => (m.id === tempId ? { ...created, sending:false } : m)));
setSel(p => p ? { ...p, unread_count: 0, last_read_message_id: created.id, last_read_at: created.created_at } : p);
} else {
setMsgs(p => p.map(m => (m.id === tempId ? { ...m, failed:true, sending:false } : m)));
}
setText(''); setAttachments([]);
} catch (e) {
console.error(e);
setMsgs(p => p.map(m => (m.id === tempId ? { ...m, failed:true, sending:false } : m)));
}
}, [sel, text, attachments, uploadLocalAttachments, setSel]);


// realtime helpers
const handleRealtimeNew = useCallback((payload) => {
const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
const msg = normalizeMessage(payload?.message ?? payload?.data ?? payload);
if (!msg) return;
if (selIdRef.current && String(selIdRef.current) === String(convId)) {
setMsgs(prev => ([...(prev||[]), msg]));
}
}, []);


const handleRealtimeUpdate = useCallback((payload) => {
const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
const msg = normalizeMessage(payload?.message ?? payload?.data ?? payload);
if (!msg || !selIdRef.current || String(selIdRef.current) !== String(convId)) return;
setMsgs(prev => prev.map(m => (m.id === msg.id ? msg : m)));
}, []);


const handleTyping = useCallback(() => {
setTyping(true);
clearTimeout(typingTimeoutRef.current);
typingTimeoutRef.current = setTimeout(() => setTyping(false), 3000);
}, []);


return {
msgs, setMsgs,
loadingMsgs,
msgHasMore,
loadOlder,
text, setText,
attachments, setAttachments,
send,
connected, setConnected,
typing,
lightbox, setLightbox,
selIdRef,
handleRealtimeNew,
handleRealtimeUpdate,
handleTyping,
};
}