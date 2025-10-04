// src/pages/inbox/hooks/useConversations.js
if (loadingRef.current) return;
loadingRef.current = true;
setListCursor(null); setListPage(1); setListHasMore(true);
try {
const r = await firstOk([
() => inboxApi.get('/inbox/conversations', { params: paramsFromFilters() }),
() => inboxApi.get('/conversations', { params: paramsFromFilters() }),
]);
const arr = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
setItems(arr);
const cursor = r?.data?.next_cursor || r?.data?.cursor;
setListCursor(cursor || null);
setListHasMore(r?.data?.has_more ?? !!cursor);
} catch (e) {
console.error(e); onError?.('Erro ao obter conversas');
} finally { loadingRef.current = false; }
}, [paramsFromFilters, onError]);


const loadMore = useCallback(async () => {
if (loadingRef.current || !listHasMore) return;
loadingRef.current = true;
const p = paramsFromFilters();
if (listCursor) p.cursor = listCursor; else p.page = listPage + 1;
try {
const r = await firstOk([
() => inboxApi.get('/inbox/conversations', { params: p }),
() => inboxApi.get('/conversations', { params: p }),
]);
const arr = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
setItems(prev => {
const map = new Map(prev.map(c => [c.id, c]));
arr.forEach(c => map.set(c.id, c));
return Array.from(map.values());
});
const cursor = r?.data?.next_cursor || r?.data?.cursor;
setListCursor(cursor || null);
setListHasMore(r?.data?.has_more ?? !!cursor);
setListPage(prev => prev + 1);
} catch (e) {
console.error(e); onError?.('Erro ao obter conversas');
} finally { loadingRef.current = false; }
}, [paramsFromFilters, listHasMore, listCursor, listPage, onError]);


useEffect(() => { load(); }, [filters, load]);


const open = useCallback(async (c) => {
setSel(c);
}, []);


// realtime: conversa atual atualizada
const handleRealtimeConv = useCallback((payload) => {
const conv = payload?.conversation;
if (!conv?.id) return;
setItems((prev) => (prev || []).map((i) => (i.id === conv.id ? { ...i, ...conv } : i)));
setSel((prev) => (prev && prev.id === conv.id ? { ...prev, ...conv } : prev));
}, []);


const filteredItems = useMemo(() => {
const q = (filters.search || '').toLowerCase();
const byCh = new Set(filters.channels || []);
const byTag = new Set((filters.tags || []).map((v) => String(v)));
const byStatus = new Set((filters.status || []).map((v) => String(v)));
return (items || []).filter((c) => {
const name = (c?.contact?.name || c?.contact?.phone_e164 || '').toLowerCase();
const okQ = !q || name.includes(q) || String(c?.id).includes(q);
const okCh = !byCh.size || byCh.has(c?.channel || c?.channel_slug);
const okStatus = !byStatus.size || byStatus.has(String(c?.status_id || ''));
const convTags = (c?.tags || []).map((t) => String(t));
const okTags = !byTag.size || convTags.some((t) => byTag.has(t));
return okQ && okCh && okStatus && okTags;
});
}, [items, filters]);


return { items, filteredItems, sel, setSel, open, loadMore, listHasMore, handleRealtimeConv };
}