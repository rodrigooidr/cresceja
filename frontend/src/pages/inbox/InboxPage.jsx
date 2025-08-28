import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import inboxApi, { apiUrl } from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';
import normalizeMessage from '../../inbox/normalizeMessage';
import channelIconBySlug from '../../inbox/channelIcons';
import EmojiPicker from '../../components/inbox/EmojiPicker.jsx';
import Lightbox from '../../components/inbox/Lightbox.jsx';
import { estimateItemHeight, computeWindow } from '../../inbox/virt';
import { readConvCache, writeConvCache, mergeMessages, pruneLRU } from '../../inbox/cache';
import {
  toggle,
  rangeToggle,
  isAllPageSelected,
  selectAllPage,
  clearAllPage,
  clearOnFilterChange,
} from '../../inbox/selection';
import {
  loadQuickReplies,
  saveQuickReply,
  updateQuickReply,
  deleteQuickReply,
  searchQuickReplies,
  parseVariables,
  fillDefaultVariables,
} from '../../inbox/quickreplies';
import { isRequired, isEmail, isE164 } from '../../inbox/validators';
import {
  loadSnippets,
  saveSnippets,
  upsertSnippet,
  deleteSnippet as removeSnippet,
  searchSnippets,
  applyVariables as applySnippetVars,
  importSnippets,
  exportSnippets,
} from '../../inbox/snippets';
import AuditPanel from '../../components/inbox/AuditPanel.jsx';
import ToastHost, { useToasts } from '../../components/ToastHost.jsx';
import { MAX_UPLOAD_MB, exceedsSize, isAllowed, violationMessage } from '../../inbox/mediaPolicy.js';
import auditlog from '../../inbox/auditlog.js';

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
function ConversationItem({ c, onOpen, active, idx, onHeight, onHover, selected, onToggle, density }) {
  const contact = c?.contact || {};
  const icon = channelIconBySlug[c?.channel] || channelIconBySlug.default;
  const photo = contact.photo_url ? apiUrl(contact.photo_url) : 'https://placehold.co/40';
  const ref = useRef(null);
  const reportHeight = useCallback(() => {
    if (ref.current && onHeight) onHeight(idx, ref.current.offsetHeight);
  }, [idx, onHeight]);
  useLayoutEffect(() => {
    reportHeight();
  }, [reportHeight, c, active]);
  return (
    <div
      ref={ref}
      onMouseEnter={() => onHover && onHover(c)}
      className={`w-full flex items-center border-b hover:bg-gray-100 ${active ? 'bg-gray-100' : ''} ${density === 'compact' ? 'text-sm' : ''}`}
    >
      <input
        type="checkbox"
        checked={!!selected}
        onChange={(e) => {
          e.stopPropagation();
          onToggle && onToggle(c.id, e);
        }}
        className="ml-2 mr-2"
        data-testid={`conv-check-${c.id}`}
      />
      <button
        onClick={() => onOpen(c)}
        className={`flex-1 px-3 ${density === 'compact' ? 'py-1' : 'py-2'} flex gap-3 text-left`}
        data-testid="conv-item"
      >
        <img src={photo} alt="avatar" className="w-10 h-10 rounded-full" onLoad={reportHeight} />
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
    </div>
  );
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [panel, setPanelState] = useState(searchParams.get('panel') === 'audit' ? 'audit' : 'details');
  const setPanel = (p) => {
    setPanelState(p);
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (p === 'details') sp.delete('panel');
      else sp.set('panel', p);
      return sp;
    });
  };
  useEffect(() => {
    const p = searchParams.get('panel');
    if (p === 'audit' || p === 'details') setPanelState(p);
  }, [searchParams]);

  // Estado base ----------------------------------------------------------
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listCursor, setListCursor] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [listHasMore, setListHasMore] = useState(true);
  const [loadingMoreList, setLoadingMoreList] = useState(false);
  const listRef = useRef(null);
  const listBottomRef = useRef(null);
  const convItemHeightsRef = useRef([]);
  const [convVirt, setConvVirt] = useState({ start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 });
  const filterSearchRef = useRef(null);
  const [sel, setSel] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selAnchor, setSelAnchor] = useState(null);
  const [undoInfo, setUndoInfo] = useState(null);
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
  const [cacheHit, setCacheHit] = useState(false);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [preloadLog, setPreloadLog] = useState('');
  const preloadingRef = useRef({});
  const hoverTimerRef = useRef(null);
  const selPreloadTimerRef = useRef(null);
  const [density, setDensity] = useState(() => localStorage.getItem('cj:inbox:density') || 'cozy');

  const toggleDensity = () => {
    const next = density === 'compact' ? 'cozy' : 'compact';
    setDensity(next);
    try {
      localStorage.setItem('cj:inbox:density', next);
    } catch {}
  };

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const role = user?.role || 'unknown';
  const unknownRole = !['agent', 'supervisor', 'org_admin', 'super_admin'].includes(role);
  const can = useCallback(
    (action) => {
      const map = {
        read: ['agent', 'supervisor', 'org_admin', 'super_admin'],
        assign: ['agent', 'supervisor', 'org_admin', 'super_admin'],
        archive: ['supervisor', 'org_admin', 'super_admin'],
        close: ['supervisor', 'org_admin', 'super_admin'],
        spam: ['org_admin', 'super_admin'],
      };
      const allowed = map[action] ? map[action].includes(role) : true;
      return unknownRole ? true : allowed;
    },
    [role, unknownRole]
  );

  const logPreload = useCallback((id) => {
    setPreloadLog((s) => s + String(id));
  }, []);

  const preloadConv = useCallback(
    async (id) => {
      if (!id) return;
      if (readConvCache(id)) return;
      if (preloadingRef.current[id]) return;
      preloadingRef.current[id] = true;
      try {
        const r = await inboxApi.get(`/conversations/${id}/messages`);
        const raw = Array.isArray(r?.data?.items)
          ? r.data.items
          : Array.isArray(r?.data)
          ? r.data
          : [];
        const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
        writeConvCache(id, { items: safe, updatedAt: Date.now(), etag: r?.headers?.etag });
        pruneLRU();
        logPreload(id);
      } catch (_) {
      } finally {
        delete preloadingRef.current[id];
      }
    },
    [logPreload]
  );

  const handleHover = useCallback(
    (c) => {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => preloadConv(c.id), 250);
    },
    [preloadConv]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const performApi = useCallback(async (action, ids, payload) => {
    try {
      await inboxApi.post('/conversations/bulk', { ids, action, payload });
    } catch (e) {
      if (e?.response?.status === 404) {
        await Promise.all(
          ids.map((id) => {
            switch (action) {
              case 'read':
                return inboxApi.post(`/conversations/${id}/read`, payload);
              case 'assign':
                return inboxApi.put(`/conversations/${id}/assign`, payload);
              case 'archive':
                return inboxApi.put(`/conversations/${id}/archive`, payload);
              case 'close':
                return inboxApi.put(`/conversations/${id}/close`, payload);
              case 'spam':
                return inboxApi.put(`/conversations/${id}/spam`, payload);
              default:
                return Promise.resolve();
            }
          })
        );
      } else {
        throw e;
      }
    }
  }, []);

  const performBulk = useCallback(
    async (action, payload = {}) => {
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      setUndoInfo({ action, ids, payload });
      clearSelection();
      setItems((prev) => {
        if (action === 'read')
          return prev.map((c) => (ids.includes(c.id) ? { ...c, unread_count: 0 } : c));
        if (action === 'assign')
          return prev.map((c) => (ids.includes(c.id) ? { ...c, assignee_id: payload.assignee_id } : c));
        if (['archive', 'close', 'spam'].includes(action))
          return prev.filter((c) => !ids.includes(c.id));
        return prev;
      });
      await performApi(action, ids, payload);
    },
    [selectedIds, clearSelection, performApi]
  );

  const inversePayload = (action, payload) => {
    switch (action) {
      case 'read':
        return { read: !payload.read };
      case 'assign':
        return { assignee_id: payload.prevAssigneeId || null };
      case 'archive':
        return { archived: false };
      case 'close':
        return { closed: false };
      case 'spam':
        return { spam: false };
      default:
        return {};
    }
  };

  const handleUndo = useCallback(async () => {
    const info = undoInfo;
    if (!info) return;
    setUndoInfo(null);
    setItems((prev) => {
      if (info.action === 'read') {
        return prev.map((c) =>
          info.ids.includes(c.id) ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
        );
      }
      return prev;
    });
    await performApi(info.action, info.ids, inversePayload(info.action, info.payload));
  }, [undoInfo, performApi]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') clearSelection();
      if (!selectedIds.size) return;
      const k = e.key.toLowerCase();
      if (k === 'r' && can('read')) performBulk('read', { read: true });
      if (k === 'x' && can('archive')) performBulk('archive', { archived: true });
      if (k === 'e' && can('close')) performBulk('close', { closed: true });
      if (k === 's' && can('spam')) performBulk('spam', { spam: true });
      if (k === 'a' && can('assign'))
        performBulk('assign', { assignee_id: user.id, prevAssigneeId: null });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, performBulk, can, user, clearSelection]);


  // Filtros --------------------------------------------------------------
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [channelFilters, setChannelFilters] = useState(
    (searchParams.get('channels') || searchParams.get('channel') || '').split(',').filter(Boolean)
  );
  const [tagFilters, setTagFilters] = useState((searchParams.get('tags') || '').split(',').filter(Boolean));
  const [statusFilters, setStatusFilters] = useState((searchParams.get('status') || '').split(',').filter(Boolean));

  useEffect(() => {
    setSelectedIds(clearOnFilterChange(selectedIds));
  }, [search, channelFilters, tagFilters, statusFilters]);

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

  // Quick replies -------------------------------------------------------
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [qrQuery, setQrQuery] = useState('');
  const [qrIdx, setQrIdx] = useState(0);
  const qrStartRef = useRef(null);
  const qrVarItemRef = useRef(null);
  const [qrVarValues, setQrVarValues] = useState({});

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

  useEffect(() => {
    loadQuickReplies().then((r) => setQuickReplies(Array.isArray(r?.items) ? r.items : [])).catch(() => {});
  }, []);

  // Composer ------------------------------------------------------------
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  // Lista de uploads em andamento/falha (somente do composer actual)
  const [uploads, setUploads] = useState([]); // estrutura: { id, file, progress, status: 'uploading'|'error', error?, controller }
  const [showEmoji, setShowEmoji] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatMatches, setChatMatches] = useState([]);
  const [chatMatchIdx, setChatMatchIdx] = useState(0);
  const chatSearchRef = useRef(null);
  const { add: addToast } = useToasts?.() || { add: () => {} };

  useEffect(() => { setShowQR(false); qrVarItemRef.current = null; }, [sel]);
  useEffect(() => { composerRef.current?.focus?.(); }, [sel?.id]);

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
  const [clientForm, setClientForm] = useState({ name: '', phone_e164: '', email: '' });
  const [clientSaved, setClientSaved] = useState({ name: '', phone_e164: '', email: '' });
  const [clientErrors, setClientErrors] = useState({});
  const [clientStatus, setClientStatus] = useState('idle');
  const [clientDirty, setClientDirty] = useState(false);
  const clientTimerRef = useRef(null);

  // Snippets ------------------------------------------------------------
  const [snipState, setSnipState] = useState(() => loadSnippets());
  const [showSnip, setShowSnip] = useState(false);
  const [snipQuery, setSnipQuery] = useState('');
  const [snipEdit, setSnipEdit] = useState(null);
  const [snipMsg, setSnipMsg] = useState('');
  const snipBtnRef = useRef(null);

  // Refs ----------------------------------------------------------------
  const msgBoxRef = useRef(null);
  const emojiRef = useRef(null);
  const composerRef = useRef(null);
  const composerBoxRef = useRef(null);
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
      setTimeout(() => {
        emojiBtnRef.current && emojiBtnRef.current.focus();
      }, 0);
    }
    prevShowEmoji.current = showEmoji;
  }, [showEmoji]);

  const openQR = useCallback(() => {
    setShowQR(true);
    setQrQuery('');
    setQrIdx(0);
    setTimeout(() => {
      const el = document.querySelector('[data-testid="qr-search"]');
      el && el.focus();
    }, 0);
  }, []);

  const closeQR = useCallback(() => {
    setShowQR(false);
    setQrQuery('');
    setQrIdx(0);
    qrVarItemRef.current = null;
    setQrVarValues({});
    setTimeout(() => composerRef.current && composerRef.current.focus(), 0);
  }, []);

  const insertText = useCallback(
    (content) => {
      const start = qrStartRef.current ?? composerRef.current?.selectionStart ?? 0;
      const end = composerRef.current?.selectionEnd ?? start;
      const before = text.slice(0, start);
      const after = text.slice(end);
      const newText = before + content + after;
      setText(newText);
      closeQR();
      setTimeout(() => {
        const pos = before.length + content.length;
        if (composerRef.current) {
          composerRef.current.selectionStart = composerRef.current.selectionEnd = pos;
          composerRef.current.focus();
        }
      }, 0);
    },
    [text, closeQR]
  );

  const selectQRItem = useCallback(
    (it) => {
      const vars = parseVariables(it.content || '');
      if (vars.length) {
        qrVarItemRef.current = it;
        const defaults = fillDefaultVariables(vars, sel);
        setQrVarValues(defaults);
        setShowQR(false);
        setQrQuery('');
        setQrIdx(0);
        setTimeout(() => {
          const el = document.querySelector(`[data-testid="qr-var-${vars[0]}"]`);
          el && el.focus();
        }, 0);
      } else {
        insertText(it.content || '');
      }
    },
    [insertText, sel]
  );

  const commitVars = useCallback(() => {
    const it = qrVarItemRef.current;
    if (!it) return;
    const vars = parseVariables(it.content || '');
    let content = it.content || '';
    vars.forEach((v) => {
      const val = qrVarValues[v] || '';
      const re = new RegExp(`\\{\\{\\s*${v}\\s*\\}}`, 'g');
      content = content.replace(re, val);
    });
    insertText(content);
    qrVarItemRef.current = null;
    setQrVarValues({});
  }, [qrVarValues, insertText]);

  const [showSaveQR, setShowSaveQR] = useState(false);
  const [saveQRForm, setSaveQRForm] = useState({ title: '', content: '', id: null });

  const openSaveQR = useCallback(() => {
    const ta = composerRef.current;
    const selText = ta && ta.selectionStart !== ta.selectionEnd
      ? ta.value.slice(ta.selectionStart, ta.selectionEnd)
      : text;
    setSaveQRForm({ title: '', content: selText, id: null });
    setShowSaveQR(true);
  }, [text]);

  const openEditQR = useCallback((it) => {
    setSaveQRForm({ title: it.title, content: it.content, id: it.id });
    setShowSaveQR(true);
  }, []);

  const handleSaveQR = useCallback(async () => {
    if (!saveQRForm.title) return;
    if (saveQRForm.id) {
      const item = await updateQuickReply(saveQRForm.id, { title: saveQRForm.title, content: saveQRForm.content });
      setQuickReplies((arr) => arr.map((i) => (String(i.id) === String(item.id) ? item : i)));
    } else {
      const item = await saveQuickReply({ title: saveQRForm.title, content: saveQRForm.content });
      setQuickReplies((arr) => [...arr, item]);
    }
    setShowSaveQR(false);
  }, [saveQRForm]);

  const handleDeleteQR = useCallback(async (id) => {
    await deleteQuickReply(id);
    setQuickReplies((arr) => arr.filter((i) => String(i.id) !== String(id)));
  }, []);


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

  const handleConvScroll = useCallback(() => {
    const root = listRef.current;
    if (!root) return;
    setConvVirt(
      computeWindow({
        scrollTop: root.scrollTop,
        viewportHeight: root.clientHeight,
        itemHeights: convItemHeightsRef.current,
        overscan: 10,
      })
    );
  }, []);

  useLayoutEffect(() => {
    handleConvScroll();
  }, []);

  useLayoutEffect(() => {
    convItemHeightsRef.current = filteredItems.map((_, i) => convItemHeightsRef.current[i] || 64);
    handleConvScroll();
  }, [filteredItems, handleConvScroll]);

  useEffect(() => {
    const root = listRef.current;
    if (root) {
      root.scrollTop = 0;
      handleConvScroll();
    }
  }, [search, channelFilters, tagFilters, statusFilters, handleConvScroll]);

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

  useEffect(() => {
    if (!sel) return;
    clearTimeout(selPreloadTimerRef.current);
    selPreloadTimerRef.current = setTimeout(() => {
      const idx = filteredItems.findIndex((c) => c.id === sel.id);
      const prev = filteredItems[idx - 1];
      const next = filteredItems[idx + 1];
      if (prev) preloadConv(prev.id);
      if (next) preloadConv(next.id);
    }, 300);
    return () => clearTimeout(selPreloadTimerRef.current);
  }, [sel, filteredItems, preloadConv]);

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
      setTemplates([]); setTemplateId('');
      const empty = { name: '', phone_e164: '', email: '' };
      setClientForm(empty);
      setClientSaved(empty);
      setClientStatus('idle');
      setClientDirty(false);
      return;
    }
    const initial = {
      name: sel?.contact?.name || '',
      phone_e164: sel?.contact?.phone_e164 || '',
      email: sel?.contact?.email || '',
    };
    setClientForm(initial);
    setClientSaved(initial);
    setClientStatus('idle');
    setClientDirty(false);

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

    s.on('conversation:new', (payload) => {
      const conv = payload?.conversation || payload;
      if (!conv?.id) return;
      convItemHeightsRef.current = [64, ...convItemHeightsRef.current];
      setItems((prev) => {
        const arr = prev || [];
        if (arr.find((c) => c.id === conv.id)) return arr;
        return [conv, ...arr];
      });
      const root = listRef.current;
      if (root && root.scrollTop > 0) {
        root.scrollTop += convItemHeightsRef.current[0] || 64;
      }
      setTimeout(() => handleConvScroll(), 0);
    });

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
      const cache = readConvCache(convId);
      if (cache) {
        const merged = mergeMessages(cache.items, [normalized]);
        writeConvCache(convId, { items: merged, updatedAt: Date.now(), etag: cache.etag });
      }
    });

    s.on('message:updated', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
      if (sel?.id && String(sel.id) === String(convId)) {
        setMsgs((prev) => (prev || []).map((m) => (m.id === normalized.id ? normalized : m)));
      }
      const cache = readConvCache(convId);
      if (cache) {
        const merged = mergeMessages(cache.items, [normalized]);
        writeConvCache(convId, { items: merged, updatedAt: Date.now(), etag: cache.etag });
      }
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
      setItems((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], ...conv };
        if (updated.archived || updated.closed || updated.spam) {
          return prev.filter((c) => c.id !== conv.id);
        }
        return prev.map((c) => (c.id === conv.id ? updated : c));
      });
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
  }, [sel, showError, resyncMessages, handleConvScroll]);

  // Abrir conversa -------------------------------------------------------
  const open = useCallback(async (c) => {
    setShowEmoji(false);
    setSel(c);
    setCacheHit(false);
    setCacheRefreshing(false);
    const cached = readConvCache(c.id);
    if (cached) {
      setCacheHit(true);
      setMsgs(cached.items);
      setMsgBefore(cached.items[0] ? cached.items[0].id : null);
      setMsgHasMore(true);
      setLoadingMsgs(false);
      setTimeout(() => {
        if (msgBoxRef.current) {
          msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
          stickToBottomRef.current = true;
          handleScroll();
        }
        composerRef.current && composerRef.current.focus();
      }, 0);
      setCacheRefreshing(true);
      try {
        const box = msgBoxRef.current;
        const prevHeight = box ? box.scrollHeight : 0;
        const prevTop = box ? box.scrollTop : 0;
        const r = await firstOk([
          () => inboxApi.get(`/conversations/${c.id}/messages`),
          () => inboxApi.get(`/inbox/conversations/${c.id}/messages`),
        ]);
        const raw = Array.isArray(r?.data?.items)
          ? r.data.items
          : Array.isArray(r?.data)
          ? r.data
          : [];
        const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
        const merged = mergeMessages(cached.items, safe);
        setMsgs(merged);
        const cursor = r?.data?.next_cursor || r?.data?.cursor || r?.data?.before;
        const hasMore = r?.data?.has_more ?? !!cursor;
        setMsgBefore(cursor || (merged[0] && merged[0].id));
        setMsgHasMore(hasMore);
        writeConvCache(c.id, { items: merged, updatedAt: Date.now(), etag: r?.headers?.etag });
        pruneLRU();
        setTimeout(() => {
          if (box) {
            const newHeight = box.scrollHeight;
            if (stickToBottomRef.current) {
              box.scrollTop = box.scrollHeight;
            } else {
              box.scrollTop = newHeight - prevHeight + prevTop;
            }
            handleScroll();
          }
          composerRef.current && composerRef.current.focus();
        }, 0);
      } catch (e) {
        console.error('Falha ao carregar mensagens', e);
      } finally {
        setCacheRefreshing(false);
      }
    } else {
      setLoadingMsgs(true);
      try {
        const r = await firstOk([
          () => inboxApi.get(`/conversations/${c.id}/messages`),
          () => inboxApi.get(`/inbox/conversations/${c.id}/messages`),
        ]);
        const raw = Array.isArray(r?.data?.items)
          ? r.data.items
          : Array.isArray(r?.data)
          ? r.data
          : [];
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
        writeConvCache(c.id, { items: safe, updatedAt: Date.now(), etag: r?.headers?.etag });
        pruneLRU();
      } catch (e) {
        console.error('Falha ao carregar mensagens', e);
        setMsgs([]);
        setMsgBefore(null);
        setMsgHasMore(false);
        showError('Erro ao carregar mensagens');
      } finally {
        setLoadingMsgs(false);
      }
    }
  }, [showError, handleScroll]);

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
      const cache = readConvCache(sel.id);
      const cacheMerged = mergeMessages(cache ? cache.items : [], safe);
      if (cache) {
        writeConvCache(sel.id, { items: cacheMerged, updatedAt: Date.now(), etag: cache.etag });
        pruneLRU();
      }
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
  function startUpload(file) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();

    setUploads((prev) => [...prev, { id, file, progress: 0, status: 'uploading', controller }]);

    const form = new FormData();
    form.append('files[]', file);

    inboxApi
      .post(
        `/conversations/${sel.id}/attachments`,
        form,
        {
          signal: controller.signal,
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            const prog = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: prog } : u)));
          },
        }
      )
      .then(({ data }) => {
        const assets = Array.isArray(data?.assets) ? data.assets : [];
        if (assets.length) {
          setAttachments((prev) => [
            ...prev,
            ...assets.map((a) => ({
              ...a,
              url: a.url,
              thumb_url: a.thumb_url,
            })),
          ]);
        }
        setUploads((prev) => prev.filter((u) => u.id !== id));
      })
      .catch((err) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'error', error: err?.message || 'Falha no upload' } : u)));
        addToast?.(`Falha ao enviar “${file.name}”.`, { variant: 'error' });
      });
  }

  function retryUpload(uploadId) {
    const u = uploads.find((x) => x.id === uploadId);
    if (!u || !sel) return;
    setUploads((prev) => prev.filter((x) => x.id !== uploadId));
    startUpload(u.file);
  }

  function cancelUpload(uploadId) {
    const u = uploads.find((x) => x.id === uploadId);
    if (!u) return;
    try {
      u.controller?.abort?.();
    } catch {}
    setUploads((prev) => prev.filter((x) => x.id !== uploadId));
  }

  const handleFiles = async (fileList) => {
    if (!sel) return;

    const files = Array.from(fileList || []);
    for (const file of files) {
      const msg = violationMessage(file);
      if (msg) {
        addToast?.(msg, { variant: 'error' });
        continue;
      }
      startUpload(file);
    }
  };

  // Inline client edit --------------------------------------------------
  const [editingClient, setEditingClient] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const editPrevRef = useRef(null);
  const phoneOk = /^\+?\d[\d\s\-()]{6,}$/.test(editPhone || '');
  const nameOk = (editName || '').trim().length >= 2;
  const canSaveClient = nameOk && phoneOk;

  const startClientEdit = () => {
    if (!sel) return;
    editPrevRef.current = { name: sel.contact?.name || '', phone_e164: sel.contact?.phone_e164 || '' };
    setEditName(sel.contact?.name || '');
    setEditPhone(sel.contact?.phone_e164 || '');
    setEditingClient(true);
  };

  const cancelClientEdit = () => {
    setEditingClient(false);
    setSel((prev) => (prev ? { ...prev, contact: editPrevRef.current } : prev));
    setItems((prev) => prev.map((c) => (c.id === sel?.id ? { ...c, contact: editPrevRef.current } : c)));
  };

  const saveClientEdit = async () => {
    if (!canSaveClient || savingClient) return;
    const payload = { name: editName.trim(), phone_e164: editPhone.trim() };
    setSavingClient(true);
    try {
      let res;
      if (sel.contact?.id) res = await inboxApi.put(`/clients/${sel.contact.id}`, payload);
      else res = await inboxApi.post('/clients', payload);
      const client = res?.data?.client || res?.data || payload;
      const normalized = {
        id: client.id || sel.contact?.id,
        name: client.name || '',
        phone_e164: client.phone_e164 || '',
        email: client.email || '',
      };
      editPrevRef.current = normalized;
      setSel((prev) => (prev ? { ...prev, contact: normalized } : prev));
      setItems((prev) => prev.map((c) => (c.id === sel.id ? { ...c, contact: normalized } : c)));
      addToast('Contato atualizado', { variant: 'success' });
    } catch (e) {
      setSel((prev) => (prev ? { ...prev, contact: editPrevRef.current } : prev));
      setItems((prev) => prev.map((c) => (c.id === sel.id ? { ...c, contact: editPrevRef.current } : c)));
      addToast('Erro ao atualizar contato', { variant: 'error' });
    }
    setSavingClient(false);
    setEditingClient(false);
  };

  useEffect(() => { setEditingClient(false); }, [sel]);

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
    closeQR();
    let payload = null;
    if (attachments.filter((a) => !a.error).length) {
      payload = { type: 'file', attachments: attachments.filter((a) => !a.error).map((a) => a.id) };
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
        auditlog.append(sel.id, { kind: 'message', action: 'sent', meta: { type: payload.type } });
      } else {
        markFailed(tempId);
        auditlog.append(sel.id, { kind: 'message', action: 'failed', meta: { type: payload.type } });
      }
      setText(''); setTemplateId(''); setTemplateVars({}); setTemplateErrors({}); setAttachments([]); setShowEmoji(false);
    } catch (e) {
      console.error('Falha ao enviar', e);
      markFailed(tempId);
      auditlog.append(sel.id, { kind: 'message', action: 'failed', meta: { type: payload.type } });
    }
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
      if (created) {
        replaceTemp(m.id, created);
        auditlog.append(sel.id, { kind: 'message', action: 'sent', meta: { type: payload.type } });
      } else {
        markFailed(m.id);
        auditlog.append(sel.id, { kind: 'message', action: 'failed', meta: { type: payload.type } });
      }
    } catch (e) {
      console.error('Falha ao reenviar', e);
      markFailed(m.id);
      auditlog.append(sel.id, { kind: 'message', action: 'failed', meta: { type: payload.type } });
    }
  };

  const handleComposerKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowSnip((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (showQR) closeQR();
        else {
          qrStartRef.current = composerRef.current?.selectionStart ?? text.length;
          openQR();
        }
        return;
      }
      if (e.key === '/' && !showQR) {
        const pos = composerRef.current?.selectionStart ?? 0;
        const before = text.slice(0, pos);
        if (pos === 0 || /\s$/.test(before)) {
          qrStartRef.current = pos;
          openQR();
        }
      }
      if (e.key === 'Escape' && showQR) {
        e.preventDefault();
        closeQR();
      }
      if (e.key === 'Escape' && showSnip) {
        e.preventDefault();
        setShowSnip(false);
        snipBtnRef.current?.focus();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [showQR, showSnip, text, openQR, closeQR, send]
  );

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
    const action = cur.includes(t) ? 'removed' : 'added';
    const newTags = action === 'removed' ? cur.filter((x) => x !== t) : [...cur, t];
    setSel((prev) => ({ ...prev, tags: newTags }));
    auditlog.append(sel.id, { kind: 'tag', action, meta: { tagId: t } });
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/tags`, { tags: newTags });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao atualizar tags', e); }
  };

  const changeStatus = async (statusId) => {
    if (!sel) return;
    setSel((prev) => ({ ...prev, status_id: statusId || '' }));
    auditlog.append(sel.id, { kind: 'crm', action: 'status_changed', meta: { to: statusId || '' } });
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/crm-status`, { status_id: statusId || null });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao atualizar status', e); }
  };

  const toggleAi = async () => {
    if (!sel || sel.is_group) return;
    const enabled = !sel.ai_enabled; setSel((prev) => ({ ...prev, ai_enabled: enabled }));
    auditlog.append(sel.id, { kind: 'ai', action: enabled ? 'enabled' : 'disabled' });
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/ai`, { enabled });
      const conv = data?.conversation || data; setSel(conv);
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) { console.error('Falha ao alternar IA', e); }
  };

  // Validação de cliente -------------------------------------------------
  const validateClient = useCallback((f) => {
    const errs = {};
    if (!isRequired(f.name)) errs.name = 'Nome obrigatório';
    if (f.phone_e164 && !isE164(f.phone_e164)) errs.phone_e164 = 'Telefone E.164 inválido';
    if (f.email && !isEmail(f.email)) errs.email = 'E-mail inválido';
    return errs;
  }, []);

  useEffect(() => {
    const errs = validateClient(clientForm);
    setClientErrors(errs);
    const dirty =
      clientForm.name !== clientSaved.name ||
      clientForm.phone_e164 !== clientSaved.phone_e164 ||
      clientForm.email !== clientSaved.email;
    setClientDirty(dirty);
  }, [clientForm, clientSaved, validateClient]);

  useEffect(() => {
    if (sel?.is_group) return;
    if (!clientDirty) return;
    if (Object.keys(clientErrors).length) return;
    setClientStatus('saving');
    if (clientTimerRef.current) clearTimeout(clientTimerRef.current);
    const payload = { ...clientForm };
    const prev = { ...clientSaved };
    clientTimerRef.current = setTimeout(async () => {
      try {
        let res;
        if (sel.contact?.id) res = await inboxApi.put(`/clients/${sel.contact.id}`, payload);
        else res = await inboxApi.post('/clients', payload);
        const client = res?.data?.client || res?.data || payload;
        const normalized = {
          name: client.name || '',
          phone_e164: client.phone_e164 || '',
          email: client.email || '',
        };
        setClientSaved(normalized);
        setClientForm(normalized);
        setSel((prevSel) => (prevSel ? { ...prevSel, contact: normalized } : prevSel));
        setItems((prevItems) =>
          (prevItems || []).map((c) => (c.id === sel.id ? { ...c, contact: normalized } : c))
        );
        setClientStatus('saved');
        setTimeout(() => setClientStatus('idle'), 1000);
      } catch (e) {
        console.error('Falha ao salvar cliente', e);
        setClientForm(prev);
        setSel((prevSel) => (prevSel ? { ...prevSel, contact: prev } : prevSel));
        setItems((prevItems) =>
          (prevItems || []).map((c) => (c.id === sel.id ? { ...c, contact: prev } : c))
        );
        setClientStatus('error');
      }
    }, 600);
    return () => clearTimeout(clientTimerRef.current);
  }, [clientForm, clientDirty, clientErrors, sel]);

  const revertClient = () => {
    setClientForm(clientSaved);
    setSel((prevSel) => (prevSel ? { ...prevSel, contact: clientSaved } : prevSel));
    setItems((prevItems) =>
      (prevItems || []).map((c) => (c.id === sel.id ? { ...c, contact: clientSaved } : c))
    );
    setClientStatus('idle');
    setClientDirty(false);
  };

  const handleClientChange = (field, value) => {
    setClientForm((f) => ({ ...f, [field]: value }));
    setSel((prevSel) =>
      prevSel ? { ...prevSel, contact: { ...prevSel.contact, [field]: value } } : prevSel
    );
    setItems((prevItems) =>
      (prevItems || []).map((c) =>
        c.id === sel?.id ? { ...c, contact: { ...(c.contact || {}), [field]: value } } : c
      )
    );
  };

  const insertSnippet = (it) => {
    const ta = composerRef.current;
    if (!ta) return;
    const content = applySnippetVars(it.content, sel?.contact);
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const newText = before + content + after;
    setText(newText);
    const pos = start + content.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
    setShowSnip(false);
  };

  const handleSnippetDelete = (id) => {
    setSnipState((s) => {
      const st = removeSnippet(s, id);
      saveSnippets(st);
      return st;
    });
  };

  const handleSnippetImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { imported, updated, ignored, state } = importSnippets(snipState, reader.result);
        setSnipState(state);
        saveSnippets(state);
        setSnipMsg(`Importados ${imported}, atualizados ${updated}, ignorados ${ignored}`);
      } catch (_) {
        setSnipMsg('Erro na importação');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSnippetExport = () => {
    const data = exportSnippets(snipState);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const composerDisabled =
    savingClient ||
    (templateId && Object.keys(templateErrors).length > 0) ||
    (uploads.some((u) => u.status === 'uploading') && !attachments.length && !templateId && !text.trim());

  const visibleItems = filteredItems.slice(convVirt.start, convVirt.end);
  const visibleIds = visibleItems.map((c) => c.id);
  const orderedIds = filteredItems.map((c) => c.id);

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
      {selectedIds.size > 0 && (
        <div
          data-testid="qa-bar"
          className="bg-white border-b p-2 flex gap-2"
          data-permission={unknownRole ? 'unknown' : undefined}
        >
          <button
            data-testid="qa-assign-btn"
            disabled={!can('assign')}
            onClick={() => can('assign') && performBulk('assign', { assignee_id: user.id, prevAssigneeId: null })}
            title={!can('assign') ? 'Sem permissão' : undefined}
            aria-label="Atribuir"
          >
            Atribuir
          </button>
          <button
            data-testid="qa-read-btn"
            disabled={!can('read')}
            onClick={() => can('read') && performBulk('read', { read: true })}
            title={!can('read') ? 'Sem permissão' : undefined}
            aria-label="Marcar como lido"
          >
            Lido
          </button>
          <button
            data-testid="qa-archive-btn"
            disabled={!can('archive')}
            onClick={() => can('archive') && performBulk('archive', { archived: true })}
            title={!can('archive') ? 'Sem permissão' : undefined}
            aria-label="Arquivar"
          >
            Arquivar
          </button>
          <button
            data-testid="qa-close-btn"
            disabled={!can('close')}
            onClick={() => can('close') && performBulk('close', { closed: true })}
            title={!can('close') ? 'Sem permissão' : undefined}
            aria-label="Encerrar"
          >
            Encerrar
          </button>
          <button
            data-testid="qa-spam-btn"
            disabled={!can('spam')}
            onClick={() => can('spam') && performBulk('spam', { spam: true })}
            title={!can('spam') ? 'Sem permissão' : undefined}
            aria-label="Spam"
          >
            Spam
          </button>
        </div>
      )}
      {undoInfo && (
        <div className="fixed bottom-2 right-2 bg-gray-800 text-white px-2 py-1 rounded" data-testid="undo-toast">
          <button data-testid="undo-btn" onClick={handleUndo} className="underline">
            Desfazer
          </button>
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

        <div
          className="flex-1 overflow-y-auto"
          ref={listRef}
          onScroll={handleConvScroll}
          data-testid="conv-list"
        >
          {loadingList ? (
            <div className="p-3 text-sm text-gray-500" data-testid="conversations-loading">Carregando…</div>
          ) : filteredItems.length ? (
            <>
              <div style={{ height: convVirt.topSpacer }} />
              <div data-testid="conv-top-sentinel" />
              {visibleItems.map((c, i) => (
                <ConversationItem
                  key={c.id}
                  c={c}
                  density={density}
                  selected={selectedIds.has(c.id)}
                  onToggle={(id, e) => {
                    setSelectedIds((prev) => {
                      if (e.shiftKey && selAnchor !== null) {
                        return rangeToggle(prev, orderedIds, selAnchor, id);
                      }
                      return toggle(prev, id);
                    });
                    if (!e.shiftKey) setSelAnchor(id);
                  }}
                  onOpen={open}
                  onHover={handleHover}
                  active={sel?.id === c.id}
                  idx={convVirt.start + i}
                  onHeight={(idx, h) => {
                    if (convItemHeightsRef.current[idx] !== h) {
                      convItemHeightsRef.current[idx] = h;
                      handleConvScroll();
                    }
                  }}
                />
              ))}
              <div ref={listBottomRef} data-testid="conv-bottom-sentinel" />
              <div style={{ height: convVirt.bottomSpacer }} />
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
              {editingClient ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border rounded px-1 text-sm w-full"
                    aria-invalid={!nameOk}
                    data-testid="client-edit-name"
                  />
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="border rounded px-1 text-xs w-full mt-1"
                    data-testid="client-edit-phone"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={saveClientEdit}
                      disabled={!canSaveClient || savingClient}
                      className="text-xs bg-blue-600 text-white px-2 rounded disabled:bg-gray-400"
                      data-testid="client-edit-save"
                    >
                      {sel.contact?.id ? 'Salvar' : 'Criar'}
                    </button>
                    <button
                      onClick={cancelClientEdit}
                      className="text-xs bg-gray-200 px-2 rounded"
                      data-testid="client-edit-cancel"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="font-medium truncate cursor-pointer"
                    onClick={startClientEdit}
                    data-testid="client-edit-toggle"
                  >
                    {sel?.contact?.name || '—'}
                  </div>
                  <div
                    className="text-xs text-gray-500 truncate cursor-pointer"
                    onClick={startClientEdit}
                    data-testid="client-edit-toggle"
                  >
                    {sel?.contact?.phone_e164 || ''}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleDensity} className="text-xs" data-testid="density-toggle">
              Densidade: {density === 'compact' ? 'Compacta' : 'Cozy'}
            </button>
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
                className={`mb-2 max-w-[70%] ${density === 'compact' ? 'p-1 text-sm' : 'p-2'} rounded ${m.from === 'customer' ? 'bg-white self-start' : 'bg-blue-100 self-end ml-auto'}`}
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
            ref={composerBoxRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            data-testid="composer-dropzone"
          >
            {/* Região acessível com status de upload */}
            <div aria-live="polite" className="sr-only" data-testid="composer-aria-live">
              {uploads.some((u) => u.status === 'error')
                ? 'Um upload falhou.'
                : uploads.some((u) => u.status === 'uploading')
                ? `Enviando ${uploads.filter((u) => u.status === 'uploading').length} arquivo(s).`
                : ''}
            </div>

            {/* Uploads in-flight / erro */}
            {uploads.length > 0 && (
              <div className="flex flex-col gap-2 mb-2" data-testid="uploader-list">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-sm">
                    <div className="truncate max-w-[40%]">{u.file?.name}</div>
                    {u.status === 'uploading' ? (
                      <>
                        <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${u.progress || 0}%` }} />
                        </div>
                        <span className="w-10 text-right">{u.progress || 0}%</span>
                        <button
                          className="px-2 py-1 text-xs bg-gray-200 rounded"
                          onClick={() => cancelUpload(u.id)}
                          aria-label="Cancelar upload"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-red-600">Falhou</span>
                        <button
                          className="px-2 py-1 text-xs bg-gray-200 rounded"
                          onClick={() => retryUpload(u.id)}
                          aria-label="Tentar novamente"
                        >
                          Tentar novamente
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-gray-200 rounded"
                          onClick={() => cancelUpload(u.id)}
                          aria-label="Remover upload com falha"
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!!attachments.length && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="relative" data-testid="pending-attachment">
                    {a.thumb_url || a.url ? (
                      <img
                        src={a.thumb_url || a.url}
                        alt="att"
                        className={`w-14 h-14 object-cover rounded ${a.error ? 'border border-red-600' : ''}`}
                      />
                    ) : (
                      <div
                        className={`w-14 h-14 flex items-center justify-center bg-gray-200 rounded text-[10px] ${
                          a.error ? 'border border-red-600' : ''
                        }`}
                      >
                        {a.name || 'arquivo'}
                      </div>
                    )}
                    {a.error && <span className="absolute bottom-0 right-0 text-red-600">!</span>}
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
                  onClick={() => setExpanded((e) => !e)}
                  className="px-2"
                  aria-label={expanded ? 'Recolher editor' : 'Expandir editor'}
                >
                  {expanded ? '↙' : '↗'}
                </button>
                <button
                  data-testid="emoji-toggle"
                  ref={emojiBtnRef}
                  onClick={() => setShowEmoji((v) => !v)}
                  className="px-2"
                  disabled={sel?.is_group}
                  aria-label="Alternar emojis"
                  aria-expanded={!!showEmoji}
                >
                  😊
                </button>

                <button
                  data-testid="qr-toggle"
                  aria-label="Respostas rápidas"
                  onClick={() => {
                    qrStartRef.current = composerRef.current?.selectionStart ?? text.length;
                    if (showQR) closeQR(); else openQR();
                  }}
                  className="px-2 py-1 rounded hover:bg-gray-100"
                  title="Respostas rápidas"
                >
                  ⚡
                </button>

                <button
                  data-testid="snippets-toggle"
                  aria-label="Snippets"
                  ref={snipBtnRef}
                  onClick={() => setShowSnip((v) => !v)}
                  className="px-2 py-1 rounded hover:bg-gray-100"
                  title="Snippets"
                >
                  📝
                </button>

                <label
                  className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                  title="Anexar"
                  aria-label="Anexar arquivos"
                >
                  📎
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    data-testid="composer-file-input"
                  />
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

                {showQR && (
                  <div
                    data-testid="qr-palette"
                    className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-2 z-10 w-60"
                    role="listbox"
                  >
                    <input
                      data-testid="qr-search"
                      value={qrQuery}
                      onChange={(e) => { setQrQuery(e.target.value); setQrIdx(0); }}
                      onKeyDown={(e) => {
                        const results = searchQuickReplies(quickReplies, qrQuery);
                        if (e.key === 'ArrowDown') { e.preventDefault(); setQrIdx((i) => Math.min(i + 1, results.length - 1)); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setQrIdx((i) => Math.max(i - 1, 0)); }
                        if (e.key === 'Enter') { e.preventDefault(); const it = results[qrIdx]; it && selectQRItem(it); }
                        if (e.key === 'Escape') { e.preventDefault(); closeQR(); }
                      }}
                      className="border rounded px-1 py-0.5 w-full mb-2"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {searchQuickReplies(quickReplies, qrQuery).slice(0,8).map((it, i) => (
                        <div
                          key={it.id}
                          data-testid={`qr-item-${it.id}`}
                          role="option"
                          onMouseDown={(e) => { e.preventDefault(); selectQRItem(it); }}
                          className={`px-2 py-1 cursor-pointer ${i === qrIdx ? 'bg-gray-100' : ''}`}
                        >
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-gray-600 truncate">{it.content}</div>
                          {it.scope === 'personal' && (
                            <div className="flex gap-1 mt-1">
                              <button
                                data-testid={`qr-edit-open-${it.id}`}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); openEditQR(it); }}
                                className="text-xs underline"
                              >
                                Editar
                              </button>
                              <button
                                data-testid={`qr-delete-${it.id}`}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteQR(it.id); }}
                                className="text-xs underline text-red-600"
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showSnip && (
                  <div
                    data-testid="snippets-palette"
                    className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-2 z-10 w-60"
                    role="dialog"
                  >
                    <input
                      data-testid="snippets-search"
                      value={snipQuery}
                      onChange={(e) => setSnipQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowSnip(false);
                          snipBtnRef.current?.focus();
                        }
                      }}
                      className="border rounded px-1 py-0.5 w-full mb-2"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {searchSnippets(snipState.items, snipQuery).map((it) => (
                        <div
                          key={it.id}
                          data-testid={`snippet-item-${it.id}`}
                          className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertSnippet(it);
                          }}
                        >
                          <div className="font-medium">{it.title}</div>
                          {it.shortcut && (
                            <div className="text-xs text-gray-600">{it.shortcut}</div>
                          )}
                          <div className="flex gap-1 mt-1">
                            <button
                              data-testid={`snippet-edit-${it.id}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setSnipEdit(it);
                              }}
                              className="text-xs underline"
                            >
                              Editar
                            </button>
                            <button
                              data-testid={`snippet-delete-${it.id}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleSnippetDelete(it.id);
                              }}
                              className="text-xs underline text-red-600"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs">
                      <button
                        data-testid="snippet-new"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSnipEdit({ title: '', content: '', shortcut: '' });
                        }}
                        className="underline"
                      >
                        Novo
                      </button>
                      <label className="underline cursor-pointer">
                        Importar
                        <input
                          type="file"
                          data-testid="snippets-import-input"
                          className="hidden"
                          onChange={handleSnippetImport}
                        />
                      </label>
                      <button
                        data-testid="snippets-export-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSnippetExport();
                        }}
                        className="underline"
                      >
                        Exportar
                      </button>
                    </div>
                    {snipMsg && (
                      <div className="text-xs mt-1" aria-live="polite">
                        {snipMsg}
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  ref={composerRef}
                  data-testid="composer-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  onPaste={(e) => { if (e.clipboardData?.files?.length) { handleFiles(e.clipboardData.files); e.preventDefault(); } }}
                  placeholder="Digite uma mensagem"
                  className={`w-full border rounded px-3 py-2 resize-none ${expanded ? 'max-h-80' : 'max-h-40'}`}
                  rows={1}
                />
              </div>

              <button
                data-testid="send-button"
                onClick={send}
                disabled={composerDisabled}
                className={`self-end px-4 py-2 rounded text-white ${composerDisabled ? 'bg-gray-400' : 'bg-blue-600'}`}
                aria-disabled={composerDisabled}
                aria-label="Enviar mensagem"
              >
                Enviar
              </button>
            </div>
            {(text.trim() || (composerRef.current && composerRef.current.selectionStart !== composerRef.current.selectionEnd)) && (
              <div className="mt-2">
                <button data-testid="qr-save-open" className="text-sm text-blue-600 underline" onClick={openSaveQR}>
                  Salvar como resposta rápida
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Painel direito */}
      <div className={`col-span-3 border-l bg-white flex flex-col ${showInfo ? '' : 'hidden xl:block'}`}>
        <div className="flex border-b text-sm">
          <button
            onClick={() => setPanel('details')}
            className={`px-4 py-2 ${panel === 'details' ? 'border-b-2 border-blue-600' : ''}`}
            aria-label="Detalhes"
          >
            Detalhes
          </button>
          <button
            onClick={() => setPanel('audit')}
            className={`px-4 py-2 ${panel === 'audit' ? 'border-b-2 border-blue-600' : ''}`}
            aria-label="Histórico"
          >
            Histórico
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {panel === 'audit' ? (
            sel ? <AuditPanel conversationId={sel.id} /> : <div className="text-gray-500">Selecione uma conversa</div>
          ) : sel ? (
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
                        aria-label={`Alternar tag ${t.name}`}
                        className={`px-2 py-1 text-xs rounded ${on ? 'bg-blue-200' : 'bg-gray-200'}`}
                        data-testid={`tag-chip-${asId(t.id)}`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-gray-500">Nome</label>
                <input
                  value={clientForm.name}
                  onChange={(e) => handleClientChange('name', e.target.value)}
                  disabled={sel.is_group}
                  title={sel.is_group ? 'Indisponível em conversas de grupo' : undefined}
                  aria-invalid={!!clientErrors.name}
                  className={`w-full border rounded px-2 py-1 ${clientErrors.name ? 'border-red-500' : ''}`}
                  data-testid="contact-name"
                />
                {clientErrors.name && (
                  <div className="text-[11px] text-red-600" data-testid="contact-error" aria-live="assertive">{clientErrors.name}</div>
                )}

                <label className="block text-xs text-gray-500">Telefone (+5511999999999)</label>
                <input
                  value={clientForm.phone_e164}
                  onChange={(e) => handleClientChange('phone_e164', e.target.value)}
                  disabled={sel.is_group}
                  title={sel.is_group ? 'Indisponível em conversas de grupo' : undefined}
                  aria-invalid={!!clientErrors.phone_e164}
                  className={`w-full border rounded px-2 py-1 ${clientErrors.phone_e164 ? 'border-red-500' : ''}`}
                  data-testid="contact-phone"
                />
                {clientErrors.phone_e164 && (
                  <div className="text-[11px] text-red-600" data-testid="contact-error" aria-live="assertive">{clientErrors.phone_e164}</div>
                )}

                <label className="block text-xs text-gray-500">E-mail</label>
                <input
                  value={clientForm.email}
                  onChange={(e) => handleClientChange('email', e.target.value)}
                  disabled={sel.is_group}
                  title={sel.is_group ? 'Indisponível em conversas de grupo' : undefined}
                  aria-invalid={!!clientErrors.email}
                  className={`w-full border rounded px-2 py-1 ${clientErrors.email ? 'border-red-500' : ''}`}
                  data-testid="contact-email"
                />
                {clientErrors.email && (
                  <div className="text-[11px] text-red-600" data-testid="contact-error" aria-live="assertive">{clientErrors.email}</div>
                )}

                {clientDirty && clientStatus !== 'saving' && (
                  <button
                    onClick={revertClient}
                    className="text-xs underline"
                    data-testid="contact-revert"
                  >
                    Reverter
                  </button>
                )}
                <div data-testid="contact-save-status" aria-live="polite" className="text-xs">
                  {clientStatus === 'saving'
                    ? 'saving…'
                    : clientStatus === 'saved'
                    ? 'salvo ✓'
                    : clientStatus === 'error'
                    ? 'erro ✕'
                    : ''}
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-4">Última atividade: {sel?.updated_at ? new Date(sel.updated_at).toLocaleString() : '-'}</div>
            </div>
          ) : (
            <div className="text-gray-500">Selecione uma conversa</div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox.open && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={closeLightbox}
        />
      )}
      {qrVarItemRef.current && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20">
          <div className="bg-white p-4 rounded shadow space-y-2">
            {parseVariables(qrVarItemRef.current.content || '').map((v) => (
              <input
                key={v}
                data-testid={`qr-var-${v}`}
                value={qrVarValues[v] || ''}
                onChange={(e) => setQrVarValues((s) => ({ ...s, [v]: e.target.value }))}
                className="border rounded px-2 py-1 w-full"
                placeholder={v}
              />
            ))}
            <button
              data-testid="qr-insert"
              onClick={commitVars}
              disabled={parseVariables(qrVarItemRef.current.content || '').some((v) => !qrVarValues[v])}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Inserir
            </button>
          </div>
        </div>
      )}
      {snipEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20">
          <div className="bg-white p-4 rounded shadow space-y-2 w-72" role="dialog">
            <input
              value={snipEdit.title}
              onChange={(e) => setSnipEdit({ ...snipEdit, title: e.target.value })}
              className="border rounded px-2 py-1 w-full"
              placeholder="Título"
            />
            <input
              value={snipEdit.shortcut || ''}
              onChange={(e) => setSnipEdit({ ...snipEdit, shortcut: e.target.value.replace(/\s+/g, '') })}
              className="border rounded px-2 py-1 w-full"
              placeholder="Atalho"
            />
            <textarea
              value={snipEdit.content}
              onChange={(e) => setSnipEdit({ ...snipEdit, content: e.target.value })}
              className="border rounded px-2 py-1 w-full"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSnipEdit(null)} className="px-3 py-1 text-sm">
                Cancelar
              </button>
              <button
                data-testid="snippet-save"
                onClick={() => {
                  setSnipState((s) => {
                    const st = upsertSnippet(s, snipEdit);
                    saveSnippets(st);
                    return st;
                  });
                  setSnipEdit(null);
                }}
                disabled={!snipEdit.title}
                className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {showSaveQR && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20">
          <div className="bg-white p-4 rounded shadow space-y-2 w-72">
            <input
              value={saveQRForm.title}
              onChange={(e) => setSaveQRForm((f) => ({ ...f, title: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
              placeholder="Título"
            />
            <textarea
              value={saveQRForm.content}
              onChange={(e) => setSaveQRForm((f) => ({ ...f, content: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
              rows={3}
            />
            <button
              data-testid="qr-save-submit"
              onClick={handleSaveQR}
              disabled={!saveQRForm.title}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
    {cacheHit && <div data-testid="cache-hit" hidden />}
    {cacheRefreshing && <div data-testid="cache-refreshing" hidden />}
    <div data-testid="prefetch-log" hidden>{preloadLog}</div>
    <ToastHost />
  </>
  );
}
