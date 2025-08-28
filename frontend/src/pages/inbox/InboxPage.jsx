import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import inboxApi, { apiUrl } from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';
import normalizeMessage from '../../inbox/normalizeMessage';
import channelIconBySlug from '../../inbox/channelIcons';
import EmojiPicker from '../../components/inbox/EmojiPicker.jsx';
import Lightbox from '../../components/inbox/Lightbox.jsx';
import { estimateItemHeight, computeWindow } from '../../inbox/virt';

// Utilidades -------------------------------------------------------------
const isImage = (u = '') => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(String(u || ''));
const asId = (v) => (v === 0 ? '0' : v ? String(v) : '');
const uniqBy = (arr, keyFn) => {
  const m = new Map();
  arr.forEach((x) => m.set(keyFn(x), x));
  return Array.from(m.values());
};


function formatRelative(date) {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} h`;
  const day = Math.floor(hr / 24);
  return `há ${day} d`;
}

async function firstOk(fns = []) {
  for (const fn of fns) {
    try { const r = await fn(); if (r?.data) return r; } catch (_) {}
  }
  throw new Error('Nenhum endpoint respondeu');
}

// Item de conversa (sidebar) --------------------------------------------
function ConversationItem({ c, onOpen, active }) {
  const contact = c?.contact || {};
  const icon = channelIconBySlug[c?.channel] || channelIconBySlug.default;
  const photo = contact.photo_url ? apiUrl(contact.photo_url) : 'https://placehold.co/40';
  return (
    <button
      onClick={() => onOpen(c)}
      className={`w-full px-3 py-2 flex gap-3 border-b hover:bg-gray-100 ${active ? 'bg-gray-100' : ''}`}
    >
      <img src={photo} alt="avatar" className="w-10 h-10 rounded-full" />
      <div className="min-w-0 text-left flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{contact.name || contact.phone_e164 || 'Contato'}</span>
          <span className="text-[11px] text-gray-500">{icon}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">{c?.status || '—'}</div>
      </div>
      {c.unread_count ? (
        <span
          className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full h-fit"
          data-testid="unread-badge"
        >
          {c.unread_count}
        </span>
      ) : null}
    </button>
  );
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado base ----------------------------------------------------------
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listCursor, setListCursor] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [listHasMore, setListHasMore] = useState(true);
  const [loadingMoreList, setLoadingMoreList] = useState(false);
  const listRef = useRef(null);
  const listBottomRef = useRef(null);
  const filterSearchRef = useRef(null);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgBefore, setMsgBefore] = useState(null);
  const [msgHasMore, setMsgHasMore] = useState(true);
  const [loadingMoreMsgs, setLoadingMoreMsgs] = useState(false);
  const topTriggerRef = useRef(null);
  const msgRefs = useRef({});
  const [virt, setVirt] = useState({ start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 });
  const itemHeightsRef = useRef([]);
  const stickToBottomRef = useRef(true);
  const [toastError, setToastError] = useState('');
  const showError = useCallback((msg) => {
    setToastError(msg || 'Erro');
    setTimeout(() => setToastError(''), 5000);
  }, []);
  const [showReconnected, setShowReconnected] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);


  // Filtros --------------------------------------------------------------
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [channelFilters, setChannelFilters] = useState(
    (searchParams.get('channels') || searchParams.get('channel') || '').split(',').filter(Boolean)
  );
  const [tagFilters, setTagFilters] = useState((searchParams.get('tags') || '').split(',').filter(Boolean));
  const [statusFilters, setStatusFilters] = useState((searchParams.get('status') || '').split(',').filter(Boolean));

  // Meta ----------------------------------------------------------------
  const [tags, setTags] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [templateVars, setTemplateVars] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});
  const templateSelectRef = useRef(null);
  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === String(templateId)) || null,
    [templates, templateId]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateErrors({});
      return;
    }
    const errs = {};
    selectedTemplate.variables?.forEach((v) => {
      if (v.required && !templateVars[v.key]) errs[v.key] = 'Obrigatório';
    });
    setTemplateErrors(errs);
  }, [selectedTemplate, templateVars]);

  useEffect(() => {
    setTemplateVars({});
  }, [templateId]);

  // Composer ------------------------------------------------------------
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatMatches, setChatMatches] = useState([]);
  const [chatMatchIdx, setChatMatchIdx] = useState(0);
  const chatSearchRef = useRef(null);

  const highlight = useCallback(
    (text = '') => {
      if (!chatSearch) return text;
      const lower = text.toLowerCase();
      const q = chatSearch.toLowerCase();
      const parts = [];
      let i = 0;
      while (true) {
        const idx = lower.indexOf(q, i);
        if (idx === -1) {
          parts.push(text.slice(i));
          break;
        }
        parts.push(text.slice(i, idx));
        parts.push(
          <mark key={idx} className="bg-yellow-200">
            {text.slice(idx, idx + q.length)}
          </mark>
        );
        i = idx + q.length;
      }
      return parts;
    },
    [chatSearch]
  );

  useEffect(() => {
    if (!chatSearch) {
      setChatMatches([]);
      setChatMatchIdx(0);
      return;
    }
    const q = chatSearch.toLowerCase();
    const arr = [];
    msgs.forEach((m) => {
      const text = (m.text || '').toLowerCase();
      let idx = text.indexOf(q);
      while (idx !== -1) {
        arr.push({ id: m.id });
        idx = text.indexOf(q, idx + q.length);
      }
    });
    setChatMatches(arr);
    setChatMatchIdx(arr.length ? 0 : 0);
  }, [chatSearch, msgs]);

  useEffect(() => {
    if (!chatMatches.length) return;
    const target = chatMatches[chatMatchIdx];
    const node = msgRefs.current[target.id];
    if (node) {
      node.scrollIntoView({ block: 'center' });
      node.classList.add('outline', 'outline-2', 'outline-yellow-400');
      setTimeout(() => node.classList.remove('outline', 'outline-2', 'outline-yellow-400'), 600);
    }
  }, [chatMatchIdx, chatMatches]);

  const nextMatch = useCallback(() => {
    if (!chatMatches.length) return;
    setChatMatchIdx((i) => (i + 1) % chatMatches.length);
  }, [chatMatches]);

  const prevMatch = useCallback(() => {
    if (!chatMatches.length) return;
    setChatMatchIdx((i) => (i - 1 + chatMatches.length) % chatMatches.length);
  }, [chatMatches]);

  // Painéis -------------------------------------------------------------
  const [showInfo, setShowInfo] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, items: [], index: 0, trigger: null });

  // Form cliente --------------------------------------------------------
  const [clientForm, setClientForm] = useState({ name: '', phone_e164: '' });
  const [clientErrors, setClientErrors] = useState({});

  // Refs ----------------------------------------------------------------
  const msgBoxRef = useRef(null);
  const emojiRef = useRef(null);
  const composerRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const handleScroll = useCallback(() => {
    const box = msgBoxRef.current;
    if (!box) return;
    const atBottom = Math.abs(box.scrollHeight - box.scrollTop - box.clientHeight) < 5;
    stickToBottomRef.current = atBottom;
    setVirt(
      computeWindow({
        scrollTop: box.scrollTop,
        viewportHeight: box.clientHeight,
        itemHeights: itemHeightsRef.current,
        overscan: 10,
      })
    );
  }, []);

  useEffect(() => {
    itemHeightsRef.current = msgs.map(
      (m, i) => itemHeightsRef.current[i] || estimateItemHeight(m)
    );
    const box = msgBoxRef.current;
    if (box) {
      if (stickToBottomRef.current) {
        box.scrollTop = box.scrollHeight;
      }
      setVirt(
        computeWindow({
          scrollTop: box.scrollTop,
          viewportHeight: box.clientHeight,
          itemHeights: itemHeightsRef.current,
          overscan: 10,
        })
      );
    }
  }, [msgs]);

  const prevShowEmoji = useRef(false);
  useEffect(() => {
    if (prevShowEmoji.current && !showEmoji) {
      emojiBtnRef.current && emojiBtnRef.current.focus();
    }
    prevShowEmoji.current = showEmoji;
  }, [showEmoji]);

  // Sincroniza estados quando searchParams mudam ------------------------
  useEffect(() => {
    const s = searchParams.get('search') || searchParams.get('q') || '';
    if (s !== search) setSearch(s);
    const ch = (searchParams.get('channels') || searchParams.get('channel') || '')
      .split(',')
      .filter(Boolean);
    if (ch.join(',') !== channelFilters.join(',')) setChannelFilters(ch);
    const tg = (searchParams.get('tags') || '').split(',').filter(Boolean);
    if (tg.join(',') !== tagFilters.join(',')) setTagFilters(tg);
    const st = (searchParams.get('status') || '').split(',').filter(Boolean);
    if (st.join(',') !== statusFilters.join(',')) setStatusFilters(st);
  }, [searchParams]);

  // Carrega tags/statuses -----------------------------------------------
  useEffect(() => {
    inboxApi.get('/tags').then(r => setTags(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => {});
    inboxApi.get('/crm/statuses').then(r => setStatuses(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => {});
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (loadingMoreList || !listHasMore) return;
    const params = {};
    if (search) params.q = search;
    if (search) params.search = search;
    if (channelFilters.length) params.channels = channelFilters.join(',');
    if (tagFilters.length) params.tags = tagFilters.join(',');
    if (statusFilters.length) params.status = statusFilters.join(',');
    if (listCursor) params.cursor = listCursor; else params.page = listPage + 1;
    setLoadingMoreList(true);
    try {
      const r = await firstOk([
        () => inboxApi.get('/inbox/conversations', { params }),
        () => inboxApi.get('/conversations', { params }),
      ]);
      const arr = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
      setItems((prev) => uniqBy([...(prev || []), ...arr], (c) => c.id));
      const cursor = r?.data?.next_cursor || r?.data?.cursor;
      const page = r?.data?.page || listPage + 1;
      const hasMore = r?.data?.has_more ?? !!cursor;
      setListCursor(cursor || null);
      setListPage(page);
      setListHasMore(hasMore);
    } catch (e) {
      console.error('Falha ao obter conversas', e);
      showError('Erro ao obter conversas');
    } finally {
      setLoadingMoreList(false);
    }
  }, [loadingMoreList, listHasMore, search, channelFilters, tagFilters, statusFilters, listCursor, listPage, showError]);

  // Busca conversas + sincroniza URL ------------------------------------
  useEffect(() => {
    const params = {};
    if (search) params.q = search;
    if (search) params.search = search;
    if (channelFilters.length) params.channels = channelFilters.join(',');
    if (tagFilters.length) params.tags = tagFilters.join(',');
    if (statusFilters.length) params.status = statusFilters.join(',');

    setLoadingList(true);
    setListCursor(null);
    setListPage(1);
    setListHasMore(true);
    const t = setTimeout(async () => {
      try {
        const r = await firstOk([
          () => inboxApi.get('/inbox/conversations', { params }),
          () => inboxApi.get('/conversations', { params }),
        ]);
        const arr = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
        setItems(arr);
        const cursor = r?.data?.next_cursor || r?.data?.cursor;
        const page = r?.data?.page || 1;
        const hasMore = r?.data?.has_more ?? !!cursor;
        setListCursor(cursor || null);
        setListPage(page);
        setListHasMore(hasMore);
      } catch (e) {
        console.error('Falha ao obter conversas', e);
        showError('Erro ao obter conversas');
      } finally {
        setLoadingList(false);
      }
    }, 300);

    setSearchParams(params, { replace: true });
    return () => clearTimeout(t);
  }, [search, channelFilters, tagFilters, statusFilters, setSearchParams, reloadTick, showError]);

  // Filtro local (fallback) ---------------------------------------------
  const filteredItems = useMemo(() => {
    const q = (search || '').toLowerCase();
    const byCh = new Set(channelFilters);
    const byTag = new Set(tagFilters.map(asId));
    const byStatus = new Set(statusFilters.map(asId));

    return (items || []).filter((c) => {
      const name = (c?.contact?.name || c?.contact?.phone_e164 || '').toLowerCase();
      const okQ = !q || name.includes(q) || String(c?.id).includes(q);
      const okCh = !byCh.size || byCh.has(c?.channel);
      const okStatus = !byStatus.size || byStatus.has(asId(c?.status_id));
      const convTags = (c?.tags || []).map(asId);
      const okTags = !byTag.size || convTags.some((t) => byTag.has(t));
      return okQ && okCh && okStatus && okTags;
    });
  }, [items, search, channelFilters, tagFilters, statusFilters]);

  useEffect(() => {
    const root = listRef.current;
    const el = listBottomRef.current;
    if (!root || !el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) loadMoreConversations();
      });
    }, { root });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMoreConversations, filteredItems.length]);

  // Emoji abre/fecha -----------------------------------------------------
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && setShowEmoji(false);
    const onClick = (e) => {
      if (showEmoji && emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    window.addEventListener('keydown', onEsc);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('click', onClick);
    };
  }, [showEmoji]);


  // Templates + form cliente quando muda a conversa ---------------------
  useEffect(() => {
    setShowEmoji(false);
    setAttachments([]);
    setTemplateVars({});
    setTemplateErrors({});
    if (!sel) {
      setTemplates([]); setTemplateId(''); setClientForm({ name: '', phone_e164: '' });
      return;
    }
    setClientForm({ name: sel?.contact?.name || '', phone_e164: sel?.contact?.phone_e164 || '' });

    if (sel.is_group) { setTemplates([]); setTemplateId(''); return; }

    inboxApi
      .get('/templates', { params: { channel: sel.channel } })
      .then((r) => setTemplates(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => setTemplates([]));
  }, [sel]);

  useEffect(() => {
    if (!sel) {
      setShowChatSearch(false);
      setChatSearch('');
      setChatMatches([]);
      setChatMatchIdx(0);
    }
  }, [sel]);

  const resyncMessages = useCallback(async () => {
    if (!sel) return;
    const last = msgs[msgs.length - 1];
    if (!last) return;
    const after = last.id || last.created_at;
    try {
      const r = await inboxApi.get(`/conversations/${sel.id}/messages`, { params: { after } });
      const raw = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
      const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
      if (safe.length) setMsgs((prev) => uniqBy([...(prev || []), ...safe], (m) => m.id));
    } catch (e) {
      console.error('Falha ao ressincronizar mensagens', e);
    }
  }, [sel, msgs]);

  // Socket ---------------------------------------------------------------
  useEffect(() => {
    const s = makeSocket();

    s.on('message:new', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
      if (sel?.id && String(sel.id) === String(convId)) {
        if (normalized.temp_id) {
          setMsgs((prev) => {
            const idx = (prev || []).findIndex((m) => m.id === normalized.temp_id);
            if (idx >= 0) {
              const arr = prev.slice();
              arr[idx] = { ...normalized, sending: false };
              return arr;
            }
            return uniqBy([...(prev || []), normalized], (m) => m.id);
          });
        } else {
          setMsgs((prev) => uniqBy([...(prev || []), normalized], (m) => m.id));
        }
        const box = msgBoxRef.current;
        const atBottom = box ? Math.abs(box.scrollHeight - box.scrollTop - box.clientHeight) < 5 : false;
        stickToBottomRef.current = atBottom;
        if (normalized.is_outbound || atBottom) {
          setSel((p) =>
            p ? { ...p, unread_count: 0, last_read_message_id: normalized.id, last_read_at: normalized.created_at } : p
          );
          setItems((prev) => (prev || []).map((c) => (c.id === sel.id ? { ...c, unread_count: 0 } : c)));
        } else {
          setSel((p) => (p ? { ...p, unread_count: (p.unread_count || 0) + 1 } : p));
          setItems((prev) => (prev || []).map((c) => (c.id === sel.id ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c)));
        }
      } else {
        setItems((prev) => (prev || []).map((c) => (c.id === convId ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c)));
      }
    });

    s.on('message:updated', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
      setMsgs((prev) => (prev || []).map((m) => (m.id === normalized.id ? normalized : m)));
    });

    s.on('message:status', (payload) => {
      const id = payload?.id || payload?.message_id;
      if (!id) return;
      const updates = {};
      if (payload.sent_at) updates.sent_at = payload.sent_at;
      if (payload.delivered_at) updates.delivered_at = payload.delivered_at;
      if (payload.read_at) updates.read_at = payload.read_at;
      if (!Object.keys(updates).length) return;
      setMsgs((prev) => (prev || []).map((m) => (String(m.id) === String(id) ? { ...m, ...updates } : m)));
    });

    s.on('conversation:sync', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      const arr = Array.isArray(payload?.messages) ? payload.messages : Array.isArray(payload?.data?.messages) ? payload.data.messages : [];
      const safe = arr.map((m) => normalizeMessage(m)).filter(Boolean);
      if (!safe.length) return;
      setMsgs((prev) => {
        const map = new Map((prev || []).map((m) => [m.id, m]));
        safe.forEach((m) => {
          const ex = map.get(m.id);
          map.set(m.id, ex ? { ...ex, ...m } : m);
        });
        return Array.from(map.values());
      });
    });

    s.on('typing:start', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      if (payload.actor === 'agent') return;
      setTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 5000);
    });

    s.on('typing:stop', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      if (payload.actor === 'agent') return;
      clearTimeout(typingTimeoutRef.current);
      setTyping(false);
    });

    s.on('conversation:updated', (payload) => {
      const conv = payload?.conversation;
      if (!conv?.id) return;
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
      if (sel?.id === conv.id) setSel((prev) => ({ ...prev, ...conv }));
    });

    s.on('disconnect', () => {
      showError('Conexão perdida');
    });

    s.on('connect', async () => {
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 2000);
      setReloadTick((v) => v + 1);
      try { await resyncMessages(); } catch {}
    });

    return () => {
      try { s.close?.(); } catch {}
      try { s.disconnect?.(); } catch {}
      clearTimeout(typingTimeoutRef.current);
    };
  }, [sel, showError, resyncMessages]);

  // Abrir conversa -------------------------------------------------------
  const open = useCallback(async (c) => {
    setShowEmoji(false);
    setSel(c); setLoadingMsgs(true);
    try {
      const r = await firstOk([
        () => inboxApi.get(`/conversations/${c.id}/messages`),
        () => inboxApi.get(`/inbox/conversations/${c.id}/messages`),
      ]);
      const raw = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
      const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
      setMsgs(safe);
      const cursor = r?.data?.next_cursor || r?.data?.cursor || r?.data?.before;
      const hasMore = r?.data?.has_more ?? !!cursor;
      setMsgBefore(cursor || (safe[0] && safe[0].id));
      setMsgHasMore(hasMore);
      setTimeout(() => {
        if (msgBoxRef.current) {
          msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
          stickToBottomRef.current = true;
          handleScroll();
        }
        composerRef.current && composerRef.current.focus();
      }, 0);
    } catch (e) {
      console.error('Falha ao carregar mensagens', e);
      setMsgs([]);
      setMsgBefore(null);
      setMsgHasMore(false);
      showError('Erro ao carregar mensagens');
    } finally { setLoadingMsgs(false); }
  }, [showError]);

  const loadOlderMessages = useCallback(async () => {
    if (!sel || loadingMoreMsgs || !msgHasMore) return;
    const params = { limit: 20 };
    if (msgBefore) params.before = msgBefore; else if (msgs[0]) params.before = msgs[0].id || msgs[0].created_at;
    const box = msgBoxRef.current;
    const prevHeight = box ? box.scrollHeight : 0;
    const prevTop = box ? box.scrollTop : 0;
    setLoadingMoreMsgs(true);
    try {
      const r = await firstOk([
        () => inboxApi.get(`/conversations/${sel.id}/messages`, { params }),
        () => inboxApi.get(`/inbox/conversations/${sel.id}/messages`, { params }),
      ]);
      const raw = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
      const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
      setMsgs((prev) => uniqBy([...safe, ...(prev || [])], (m) => m.id));
      const cursor = r?.data?.next_cursor || r?.data?.cursor || r?.data?.before;
      const hasMore = r?.data?.has_more ?? !!cursor;
      setMsgBefore(cursor || (safe[0] && safe[0].id));
      setMsgHasMore(hasMore);
      setTimeout(() => {
        if (box) {
          const newHeight = box.scrollHeight;
          box.scrollTop = newHeight - prevHeight + prevTop;
          handleScroll();
        }
        composerRef.current && composerRef.current.focus();
      }, 0);
    } catch (e) {
      console.error('Falha ao carregar mensagens', e);
      showError('Erro ao carregar mensagens');
    } finally {
      setLoadingMoreMsgs(false);
    }
  }, [sel, loadingMoreMsgs, msgHasMore, msgBefore, msgs, showError]);

  useEffect(() => {
    if (!sel) return;
    const root = msgBoxRef.current;
    const el = topTriggerRef.current;
    if (!root || !el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) loadOlderMessages();
      });
    }, { root });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadOlderMessages, sel, msgs.length]);

  // Atalhos de teclado ---------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        filterSearchRef.current && filterSearchRef.current.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowChatSearch((v) => {
          const nv = !v;
          if (!nv) setChatSearch('');
          setTimeout(() => { if (nv) chatSearchRef.current && chatSearchRef.current.focus(); }, 0);
          return nv;
        });
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (!filteredItems.length) return;
        const idx = filteredItems.findIndex((c) => sel && c.id === sel.id);
        const next = filteredItems[(idx + 1) % filteredItems.length];
        if (next) open(next);
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (!filteredItems.length) return;
        const idx = filteredItems.findIndex((c) => sel && c.id === sel.id);
        const prev = filteredItems[(idx - 1 + filteredItems.length) % filteredItems.length];
        if (prev) open(prev);
      }
      if (e.key === 'Escape') {
        setShowEmoji(false);
        setLightbox((l) => (l.open ? { ...l, open: false } : l));
        setShowChatSearch(false);
      }
      if (e.key === '/' && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
        templateSelectRef.current && templateSelectRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredItems, sel, open, showChatSearch]);

  const separatorIdx = useMemo(() => {
    if (!sel) return -1;
    const lastReadId = asId(sel.last_read_message_id);
    const lastReadAt = sel.last_read_at ? new Date(sel.last_read_at).getTime() : null;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (lastReadId && asId(m.id) === lastReadId) return i + 1;
      if (lastReadAt && new Date(m.created_at).getTime() > lastReadAt) return i;
    }
    return -1;
  }, [sel, msgs]);

  // Upload ---------------------------------------------------------------
  const handleFiles = async (fileList) => {
    if (!sel) return;
    const files = Array.from(fileList || []);
    const uploaded = [];
    setUploadError('');
    for (const f of files) {
      const form = new FormData();
      form.append('files[]', f);
      try {
        const { data } = await inboxApi.post(`/conversations/${sel.id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const assets = Array.isArray(data?.assets)
          ? data.assets.map((a) => ({ ...a, url: apiUrl(a.url), thumb_url: apiUrl(a.thumb_url) }))
          : [];
        uploaded.push(...assets);
      } catch (e) {
        console.error('Falha no upload', e);
        setUploadError('Erro ao enviar arquivo');
      }
    }
    if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded]);
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const renderTemplatePreview = (tpl, vars = {}) => {
    const body = tpl?.body || tpl?.text || '';
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
  };

  // Envio otimista -------------------------------------------------------
  const replaceTemp = (id, real) =>
    setMsgs((p) => {
      const idx = (p || []).findIndex((m) => m.id === id);
      if (idx >= 0) return p.map((m) => (m.id === id ? { ...real, sending: false } : m));
      return uniqBy([...(p || []), { ...real, sending: false }], (m) => m.id);
    });
  const markFailed = (id) =>
    setMsgs((p) => (p || []).map((m) => (m.id === id ? { ...m, failed: true, sending: false } : m)));

  const markAllRead = async () => {
    if (!sel) return;
    try {
      await inboxApi.put(`/conversations/${sel.id}/read`);
      const last = msgs[msgs.length - 1];
      setSel((p) =>
        p
          ? { ...p, unread_count: 0, last_read_at: new Date().toISOString(), last_read_message_id: last?.id }
          : p
      );
      setItems((prev) => (prev || []).map((c) => (c.id === sel.id ? { ...c, unread_count: 0 } : c)));
    } catch (e) {
      console.error('Falha ao marcar como lido', e);
      showError('Erro ao marcar como lido');
    }
  };

  const send = async () => {
    if (!sel) return;
    setShowEmoji(false);
    let payload = null;
    if (attachments.length) {
      payload = { type: 'file', attachments: attachments.map((a) => a.id) };
    } else if (templateId) {
      const vars = { ...templateVars };
      const errs = {};
      selectedTemplate?.variables?.forEach((v) => {
        if (v.required && !vars[v.key]) errs[v.key] = 'Obrigatório';
      });
      setTemplateErrors(errs);
      if (Object.keys(errs).length) return;
      payload = { type: 'template', template_id: templateId, variables: vars };
    } else if (text.trim()) {
      payload = { type: 'text', text: text.trim() };
    } else return;

    const tempId = `temp:${Date.now()}:${Math.random()}`;
    const base = normalizeMessage({
      id: tempId,
      temp_id: tempId,
      type: payload.type || 'text',
      text:
        payload.type === 'template'
          ? renderTemplatePreview(selectedTemplate, payload.variables)
          : payload.text || '',
      is_outbound: true,
      attachments: (payload.attachments || []).map((id) => attachments.find((a) => a.id === id)),
      created_at: new Date().toISOString(),
    });
    const optimistic = {
      ...base,
      template_id: payload.template_id,
      variables: payload.variables,
      sending: true,
    };
    setMsgs((prev) => [...(prev || []), optimistic]);
    stickToBottomRef.current = true;

    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, { ...payload, temp_id: tempId });
      const createdRaw = res?.data?.message ?? res?.data?.data ?? res?.data;
      const created = normalizeMessage(createdRaw);
      if (created) {
        replaceTemp(tempId, created);
        setSel((p) => (p ? { ...p, unread_count: 0, last_read_message_id: created.id, last_read_at: created.created_at } : p));
        setItems((prev) => (prev || []).map((c) => (c.id === sel.id ? { ...c, unread_count: 0 } : c)));
      } else markFailed(tempId);
      setText(''); setTemplateId(''); setTemplateVars({}); setTemplateErrors({}); setAttachments([]); setUploadError('');
    } catch (e) { console.error('Falha ao enviar', e); markFailed(tempId); }
  };

  const resend = async (m) => {
    if (!sel) return;
    let payload;
    if (m.type === 'file') {
      payload = { type: 'file', attachments: (m.attachments || []).map((a) => a.id) };
    } else if (m.type === 'template') {
      payload = { type: 'template', template_id: m.template_id, variables: m.variables };
    } else {
      payload = { type: 'text', text: m.text };
    }
    setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, failed: false, sending: true } : x)));
    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, { ...payload, temp_id: m.id });
      const created = normalizeMessage(res?.data?.message ?? res?.data?.data ?? res?.data);
      if (created) replaceTemp(m.id, created); else markFailed(m.id);
    } catch (e) { console.error('Falha ao reenviar', e); markFailed(m.id); }
  };

  const closeLightbox = useCallback(() => {
    const trigger = lightbox.trigger;
    setLightbox({ open: false, items: [], index: 0, trigger: null });
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
  }, [lightbox]);

  // Tags / Status / IA ---------------------------------------------------
  const toggleTag = async (tagId) => {
    if (!sel) return;
    const cur = (sel.tags || []).map(asId);
    const t = asId(tagId);
    const newTags = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    setSel((prev) => ({ ...prev, tags: newTags }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/tags`, { tags: newTags });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao atualizar tags', e); }
  };

  const changeStatus = async (statusId) => {
    if (!sel) return;
    setSel((prev) => ({ ...prev, status_id: statusId || '' }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/crm-status`, { status_id: statusId || null });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao atualizar status', e); }
  };

  const toggleAi = async () => {
    if (!sel || sel.is_group) return;
    const enabled = !sel.ai_enabled; setSel((prev) => ({ ...prev, ai_enabled: enabled }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/ai`, { enabled });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao alternar IA', e); }
  };

  // Validação de cliente -------------------------------------------------
  const validateClient = useCallback((f) => {
    const errs = {};
    if (!f.name || !f.name.trim()) errs.name = 'Nome obrigatório';
    if (f.phone_e164 && !/^\+?[1-9]\d{7,14}$/.test(f.phone_e164)) errs.phone_e164 = 'Telefone E.164 inválido';
    return errs;
  }, []);

  useEffect(() => { setClientErrors(validateClient(clientForm)); }, [clientForm, validateClient]);

  const saveClient = async () => {
    if (!sel || sel.is_group) return;
    const errs = validateClient(clientForm); setClientErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      let res; if (sel.contact?.id) res = await inboxApi.put(`/clients/${sel.contact.id}`, clientForm); else res = await inboxApi.post('/clients', clientForm);
      const client = res?.data?.client || res?.data; setSel((prev) => ({ ...prev, contact: client }));
    } catch (e) { console.error('Falha ao salvar cliente', e); }
  };

  const sendDisabled = templateId && Object.keys(templateErrors).length > 0;

  // Render ---------------------------------------------------------------
  return (
    <>
      {toastError && (
        <div
          data-testid="toast-error"
          className="fixed top-2 right-2 bg-red-600 text-white px-2 py-1 rounded"
        >
          {toastError}
        </div>
      )}
      <div className="grid grid-cols-12 h-[calc(100vh-80px)] bg-gray-50">
      {/* Sidebar (esquerda) */}
      <div className="col-span-3 border-r bg-white flex flex-col">
        <div className="p-3 border-b">
          <input
            ref={filterSearchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="w-full border rounded-full px-4 py-2 text-sm"
            data-testid="filter-search-input"
          />
          <div className="mt-2 flex gap-2 text-xs flex-wrap">
            {['whatsapp', 'instagram', 'facebook'].map((ch) => (
              <label key={ch} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                <input
                  type="checkbox"
                  checked={channelFilters.includes(ch)}
                  onChange={(e) => setChannelFilters((prev) => (e.target.checked ? [...prev, ch] : prev.filter((c) => c !== ch)))}
                  data-testid={`filter-channel-checkbox-${ch}`}
                />
                {ch}
              </label>
            ))}
          </div>
          {!!tags.length && (
            <div className="mt-2">
              <label className="text-[11px] text-gray-500">Etiquetas</label>
              <select
                multiple
                value={tagFilters}
                onChange={(e) => setTagFilters(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                data-testid="filter-tags-select"
              >
                {tags.map((t) => (
                  <option key={asId(t.id)} value={asId(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          {!!statuses.length && (
            <div className="mt-2">
              <label className="text-[11px] text-gray-500">Status CRM</label>
              <select
                multiple
                value={statusFilters}
                onChange={(e) => setStatusFilters(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                data-testid="filter-status-select"
              >
                {statuses.map((s) => (
                  <option key={asId(s.id)} value={asId(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {loadingList ? (
            <div className="p-3 text-sm text-gray-500" data-testid="conversations-loading">Carregando…</div>
          ) : filteredItems.length ? (
            <>
              {filteredItems.map((c) => (
                <ConversationItem key={c.id} c={c} onOpen={open} active={sel?.id === c.id} />
              ))}
              <div ref={listBottomRef} data-testid="infinite-trigger-bottom" />
              {loadingMoreList && (
                <div className="p-3 text-sm text-gray-500">Carregando…</div>
              )}
            </>
          ) : (
            <div className="p-3 text-sm text-gray-500" data-testid="conversations-empty">Nenhuma conversa.</div>
          )}
        </div>
      </div>

      {/* Chat (centro) */}
      <div className="col-span-6 flex flex-col bg-gray-100">
        {/* Header estilo WhatsApp */}
        <div className="h-14 bg-white border-b px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={sel?.contact?.photo_url ? apiUrl(sel.contact.photo_url) : 'https://placehold.co/40'}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{sel?.contact?.name || '—'}</div>
              <div className="text-xs text-gray-500 truncate">{sel?.contact?.phone_e164 || ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!sel?.ai_enabled}
                onChange={toggleAi}
                disabled={sel?.is_group}
                data-testid="ai-toggle"
              />
              IA
            </label>
            {sel?.is_group && (
              <span className="text-[10px] text-gray-500" data-testid="ai-toggle-disabled-hint">
                Indisponível em grupos
              </span>
            )}
            <button className="text-sm" onClick={() => setShowInfo((v) => !v)} title="Detalhes">ℹ️</button>
          </div>
        </div>

        <div className="bg-white border-b p-2 text-right">
          <button
            className="text-xs underline"
            onClick={markAllRead}
            data-testid="mark-all-read"
          >
            Marcar como lido
          </button>
        </div>
        {showReconnected && (
          <div className="text-center text-xs bg-yellow-100" data-testid="socket-reconnected">
            Reconectado
          </div>
        )}

          {showChatSearch && (
            <div className="p-2 border-b flex items-center gap-2 bg-white">
              <input
                ref={chatSearchRef}
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch(); }
                  if (e.key === 'Escape') { e.stopPropagation(); setChatSearch(''); }
                }}
                placeholder="Buscar"
                className="flex-1 border rounded px-2 py-1 text-sm"
                data-testid="chat-search-input"
              />
              <button onClick={prevMatch} data-testid="chat-search-prev" className="px-2">↑</button>
              <button onClick={nextMatch} data-testid="chat-search-next" className="px-2">↓</button>
              <span data-testid="chat-search-count" className="text-xs">
                {chatMatches.length ? `${chatMatchIdx + 1}/${chatMatches.length}` : '0/0'}
              </span>
            </div>
          )}

          {/* Mensagens */}
          <div
            ref={msgBoxRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4"
            data-testid="messages-container"
          >
          <div ref={topTriggerRef} data-testid="infinite-trigger-top" />
          <div style={{ height: virt.topSpacer }} />
          {(loadingMoreMsgs || loadingMsgs) && (
            <div className="text-sm text-gray-500">Carregando…</div>
          )}
          {msgs.slice(virt.start, virt.end).map((m, i) => {
            const idx = virt.start + i;
            return (
            <React.Fragment key={m.id}>
              {idx === separatorIdx && (
                <hr data-testid="new-messages-separator" />
              )}
              <div
                ref={(el) => {
                  if (el) {
                    msgRefs.current[m.id] = el;
                    const h = el.offsetHeight;
                    if (itemHeightsRef.current[idx] !== h) {
                      itemHeightsRef.current[idx] = h;
                      const box = msgBoxRef.current;
                      if (box) {
                        setVirt(
                          computeWindow({
                            scrollTop: box.scrollTop,
                            viewportHeight: box.clientHeight,
                            itemHeights: itemHeightsRef.current,
                            overscan: 10,
                          })
                        );
                      }
                    }
                  }
                }}
                data-message="true"
                data-testid={m.failed ? 'msg-failed' : m.sending ? 'msg-sending' : undefined}
                data-status={m.failed ? 'failed' : m.sending ? 'sending' : 'sent'}
                className={`mb-2 max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-white self-start' : 'bg-blue-100 self-end ml-auto'}`}
              >
                {m.text && <div className="whitespace-pre-wrap">{highlight(m.text)}</div>}

              {!!m.attachments?.length && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.attachments.map((a) => {
                    const href = a.url || '#';
                    const thumb = a.thumb_url || a.url;
                    const isImg = isImage(a.url || a.thumb_url);
                    const open = (e) => {
                      if (isImg) {
                        e.preventDefault();
                        const imgs = m.attachments
                          .filter((x) => isImage(x.url || x.thumb_url))
                          .map((x) => ({ src: x.url || x.thumb_url }));
                        const idx = imgs.findIndex((x) => x.src === (a.url || a.thumb_url));
                        setLightbox({ open: true, items: imgs, index: idx >= 0 ? idx : 0, trigger: e.currentTarget });
                      }
                    };
                    return (
                      <a
                        key={a.id || href}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={open}
                        data-testid="attachment-thumb"
                        download={isImg ? undefined : ''}
                      >
                        {thumb ? (
                          <img src={thumb} alt="file" className="w-28 h-28 object-cover rounded" />
                        ) : (
                          <span className="underline text-sm">arquivo</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}

              {m.type === 'audio' && m.audio_url && (
                <div className="mt-1">
                  <audio controls src={m.audio_url} className="w-60" />
                  <div className="text-xs text-gray-500 mt-1">{m.transcript_text ? m.transcript_text : 'Transcrevendo...'}</div>
                </div>
              )}

                    <div className="mt-1 flex items-center justify-end gap-2">
                      {m.failed && (
                        <button
                          className="text-[10px] text-red-600 underline"
                          onClick={() => resend(m)}
                          data-testid="retry-button"
                          aria-label="Tentar novamente"
                        >
                          Falha — Tentar novamente
                        </button>
                      )}
                      {m.sending && !m.failed && <span className="text-[10px] text-gray-400">Enviando…</span>}
                      {m.from === 'agent' && (m.sent_at || m.delivered_at || m.read_at) ? (
                        <span
                          data-testid="msg-receipt"
                          className={`text-[10px] ${m.read_at ? 'text-blue-600' : 'text-gray-500'}`}
                          aria-label={m.read_at ? 'Lida' : m.delivered_at ? 'Entregue' : 'Enviada'}
                          title={`${formatRelative(m.read_at || m.delivered_at || m.sent_at)} — ${new Date(m.read_at || m.delivered_at || m.sent_at).toLocaleString()}`}
                        >
                          {m.read_at ? '✓✓' : m.delivered_at ? '✓✓' : '✓'}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-gray-500" title={new Date(m.created_at).toLocaleString()}>{formatRelative(m.created_at)}</span>
                    </div>
                  </div>
                </React.Fragment>
            );
          })}
          <div style={{ height: virt.bottomSpacer }} />
          </div>
        {sel && typing && (
          <div
            data-testid="typing-indicator"
            className="px-4 py-1 text-xs text-gray-500"
            aria-label="Contato digitando"
            title="Contato digitando"
          >
            digitando…
          </div>
        )}

        {/* Composer */}
        {sel && (
          <div
            className="bg-white border-t p-3"
            ref={composerRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            data-testid="composer-dropzone"
          >
            {!!attachments.length && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="relative" data-testid="pending-attachment">
                    <img src={a.thumb_url || a.url} alt="att" className="w-14 h-14 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="absolute top-0 right-0 text-xs bg-white rounded-full px-1"
                      data-testid="remove-pending-attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadError && <div className="text-xs text-red-600 mb-2">{uploadError}</div>}

            {selectedTemplate && (
              <div className="mb-2 space-y-1">
                {selectedTemplate.variables?.map((v) => (
                  <div key={v.key}>
                    <input
                      value={templateVars[v.key] || ''}
                      onChange={(e) =>
                        setTemplateVars((prev) => ({ ...prev, [v.key]: e.target.value }))
                      }
                      className={`border rounded px-2 py-1 text-sm w-full ${
                        templateErrors[v.key] ? 'border-red-500' : ''
                      }`}
                      placeholder={v.key}
                      aria-label={v.key}
                      data-testid={`template-var-${v.key}`}
                    />
                    {templateErrors[v.key] && (
                      <div className="text-[11px] text-red-600">{templateErrors[v.key]}</div>
                    )}
                  </div>
                ))}
                <div
                  className="text-sm text-gray-700 whitespace-pre-wrap"
                  data-testid="template-preview"
                >
                  {renderTemplatePreview(selectedTemplate, templateVars)}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  data-testid="emoji-toggle"
                  ref={emojiBtnRef}
                  aria-label="Emojis"
                  onClick={(e) => { e.stopPropagation(); setShowEmoji((v) => !v); }}
                  className="px-2 py-1 rounded hover:bg-gray-100"
                  title="Emojis"
                  disabled={sel.is_group}
                >
                  😊
                </button>

                <label
                  className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                  title="Anexar"
                  aria-label="Anexar arquivos"
                >
                  📎
                  <input type="file" className="hidden" multiple onChange={(e) => handleFiles(e.target.files)} />
                </label>

                  {!sel.is_group && !!templates.length && (
                    <select
                      ref={templateSelectRef}
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid="template-select"
                      aria-label="Template"
                    >
                      <option value="">Template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
              </div>

              <div className="relative flex-1">
                {showEmoji && (
                  <div
                    ref={emojiRef}
                    data-testid="emoji-popover"
                    className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-2 z-10"
                  >
                    {EmojiPicker ? (
                      <EmojiPicker onSelect={(e) => setText((t) => t + e)} />
                    ) : (
                      <div className="flex gap-2 text-xl">
                        {['😀','😅','😍','👍','🙏','🎉','🔥','🥳'].map((em) => (
                          <button key={em} onClick={() => setText((t) => t + em)}>{em}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  data-testid="composer-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null)}
                  onPaste={(e) => { if (e.clipboardData?.files?.length) { handleFiles(e.clipboardData.files); e.preventDefault(); } }}
                  placeholder="Digite uma mensagem"
                  className="w-full border rounded px-3 py-2 resize-none max-h-40"
                  rows={1}
                />
              </div>

              <button
                data-testid="send-button"
                onClick={send}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={sendDisabled}
                aria-label="Enviar mensagem"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Painel direito (detalhes) */}
      <div className={`col-span-3 border-l bg-white p-4 ${showInfo ? '' : 'hidden xl:block'}`}>
        {sel ? (
          <div>
            <div className="text-xs text-gray-500 mb-2">Detalhes do contato</div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src={sel?.contact?.photo_url ? apiUrl(sel.contact.photo_url) : 'https://placehold.co/56'}
                alt="avatar"
                className="w-14 h-14 rounded-full"
              />
              <div>
                <div className="font-semibold">{sel?.contact?.name || 'Contato'}</div>
                <div className="text-sm text-gray-500">{sel?.contact?.phone_e164 || ''}</div>
                <div className="text-xs text-gray-500">Canal: {sel?.channel || '-'}</div>
              </div>
            </div>

            {!!statuses.length && (
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Status CRM</label>
                <select
                  value={asId(sel?.status_id) || ''}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                  data-testid="crm-status-select"
                >
                  <option value="">Sem status</option>
                  {statuses.map((s) => (
                    <option key={asId(s.id)} value={asId(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">Etiquetas</div>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => {
                  const on = (sel?.tags || []).map(asId).includes(asId(t.id));
                  return (
                    <button
                      key={asId(t.id)}
                      onClick={() => toggleTag(t.id)}
                      className={`px-2 py-1 text-xs rounded ${on ? 'bg-blue-200' : 'bg-gray-200'}`}
                      data-testid={`tag-chip-${asId(t.id)}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {sel.is_group ? (
              <div className="text-xs text-red-500">Conversa em grupo – cadastro desabilitado</div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-gray-500">Nome</label>
                <input
                  value={clientForm.name}
                  onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full border rounded px-2 py-1 ${clientErrors.name ? 'border-red-500' : ''}`}
                />
                {clientErrors.name && (
                  <div className="text-[11px] text-red-600" data-testid="client-name-error">{clientErrors.name}</div>
                )}

                <label className="block text-xs text-gray-500">Telefone (+5511999999999)</label>
                <input
                  value={clientForm.phone_e164}
                  onChange={(e) => setClientForm((f) => ({ ...f, phone_e164: e.target.value }))}
                  className={`w-full border rounded px-2 py-1 ${clientErrors.phone_e164 ? 'border-red-500' : ''}`}
                />
                {clientErrors.phone_e164 && <div className="text-[11px] text-red-600">{clientErrors.phone_e164}</div>}

                <button
                  onClick={saveClient}
                  disabled={Object.keys(clientErrors).length > 0}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
                  data-testid="client-save"
                >
                  {sel?.contact?.id ? 'Salvar' : 'Criar'}
                </button>
              </div>
            )}

            <div className="text-xs text-gray-500 mt-4">Última atividade: {sel?.updated_at ? new Date(sel.updated_at).toLocaleString() : '-'}</div>
          </div>
        ) : (
          <div className="text-gray-500">Selecione uma conversa</div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox.open && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={closeLightbox}
        />
      )}
    </div>
  </>
  );
}
