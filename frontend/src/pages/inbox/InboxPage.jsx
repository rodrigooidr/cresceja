// src/pages/inbox/InboxPage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import inboxApi from '../../api/inboxApi'; // <- só default
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
import { MAX_UPLOAD_MB, exceedsSize /* isAllowed, violationMessage */ } from '../../inbox/mediaPolicy.js';
import auditlog from '../../inbox/auditlog.js';

// ------------------------------------------------------------- Utils

// base para montar URLs absolutas a partir do baseURL do axios
const __API_BASE = (() => {
  const b = inboxApi?.defaults?.baseURL || '';
  // ex.: http://localhost:4000/api -> http://localhost:4000
  return b.replace(/\/api\/?$/, '');
})();

const apiUrl = (u) => {
  if (!u) return '';
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${__API_BASE}${s}`;
  return `${__API_BASE}/${s}`;
};

// URL que pode vir relativa do backend
const safeApiUrl = (u) => (u ? apiUrl(u) : undefined);

const isImage = (u = '') => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(String(u || ''));
const asId = (v) => (v === 0 ? '0' : v ? String(v) : '');
const uniqBy = (arr, keyFn) => {
  const m = new Map();
  arr.forEach((x) => m.set(keyFn(x), x));
  return Array.from(m.values());
};
const toDateInput = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fromDateInput = (val) => (val ? new Date(val).toISOString() : null);

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
    try { const r = await fn(); if (r?.data) return r; } catch (_) { }
  }
  throw new Error('Nenhum endpoint respondeu');
}

/**
 * Fecha um popover ao clicar fora (em captura) ou pressionar ESC.
 * Aceita refs a serem ignoradas (ex.: o botão que abriu o popover).
 */
function useOutsideClose(ref, onClose, deps = [], ignoreRefs = []) {
  React.useEffect(() => {
    const onDocClick = (e) => {
      const t = e.target;
      const inside = ref.current && ref.current.contains(t);
      const inIgnored = ignoreRefs.some(r => r?.current && r.current.contains(t));
      if (!inside && !inIgnored) onClose?.();
    };
    const onKey = (ev) => { if (ev.key === 'Escape') onClose?.(); };

    document.addEventListener('click', onDocClick, true); // captura
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line
  }, deps);
}

// ------------------------------------------------------------- Conversation item
function ConversationItem({ c, onOpen, active, idx, onHeight, onHover, selected, onToggle, density }) {
  const contact = c?.contact || {};
  const icon = channelIconBySlug[c?.channel] || channelIconBySlug.default;
  const photo = contact.photo_url ? apiUrl(contact.photo_url) : 'https://placehold.co/40';
  const ref = useRef(null);
  const reportHeight = useCallback(() => {
    if (ref.current && onHeight) onHeight(idx, ref.current.offsetHeight);
  }, [idx, onHeight]);
  useLayoutEffect(() => { reportHeight(); }, [reportHeight, c, active]);

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
        {c?.unread_count > 0 && (
          <span
            className="ml-2 shrink-0 rounded-full bg-blue-600 text-white text-xs px-2 py-0.5"
            data-testid="unread-badge"
          >
            {c.unread_count}
          </span>
        )}
      </button>
    </div>
  );
}

// ------------------------------------------------------------- Page
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

  // ------------------------------ Estado base
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

  // ---------- toasts (sempre função)
  let addToast = () => {};
  try {
    const toastsCtx = useToasts ? useToasts() : null;
    if (toastsCtx && typeof toastsCtx.add === 'function') addToast = toastsCtx.add;
  } catch { /* noop */ }

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
  const [connected, setConnected] = useState(true);
  const [typing, setTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // drafts por conversa
  const DRAFTS_KEY = 'cj:inbox:drafts';
  const draftsRef = useRef({});
  useEffect(() => {
    try { draftsRef.current = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}'); } catch { draftsRef.current = {}; }
  }, []);
  const saveDraft = useCallback((convId, draft) => {
    if (!convId) return;
    draftsRef.current = { ...(draftsRef.current || {}), [convId]: draft || '' };
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(draftsRef.current)); } catch {}
  }, []);
  const loadDraft = useCallback((convId) => (draftsRef.current?.[convId] || ''), []);

  const toggleDensity = () => {
    const next = density === 'compact' ? 'cozy' : 'compact';
    setDensity(next);
    try { localStorage.setItem('cj:inbox:density', next); } catch { }
  };

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  }, []);
  const role = user?.role || 'unknown';
  const unknownRole = !['agent', 'supervisor', 'org_admin', 'super_admin', 'manager', 'OrgOwner', 'SuperAdmin'].includes(role);
  const can = useCallback(
    (action) => {
      const map = {
        read: ['agent', 'supervisor', 'org_admin', 'super_admin', 'manager', 'OrgOwner', 'SuperAdmin'],
        assign: ['agent', 'supervisor', 'org_admin', 'super_admin', 'manager', 'OrgOwner', 'SuperAdmin'],
        archive: ['supervisor', 'org_admin', 'super_admin', 'manager', 'OrgOwner', 'SuperAdmin'],
        close: ['supervisor', 'org_admin', 'super_admin', 'manager', 'OrgOwner', 'SuperAdmin'],
        spam: ['org_admin', 'super_admin', 'SuperAdmin'],
      };
      const allowed = map[action] ? map[action].includes(role) : true;
      return unknownRole ? true : allowed;
    },
    [role, unknownRole]
  );

  const logPreload = useCallback((id) => {
    setPreloadLog((s) => s + String(id));
  }, []);

  async function markRead(conversationId) {
    if (!conversationId) return;
    setItems((prev) =>
      (prev || []).map((c) =>
        String(c.id) === String(conversationId) ? { ...c, unread_count: 0 } : c
      )
    );
    try {
      await inboxApi.post(`/conversations/${conversationId}/read`);
    } catch { }
  }

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

  // ------------------------------ Filtros
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [channelFilters, setChannelFilters] = useState(
    (searchParams.get('channels') || searchParams.get('channel') || '').split(',').filter(Boolean)
  );
  const [tagFilters, setTagFilters] = useState((searchParams.get('tags') || '').split(',').filter(Boolean));
  const [statusFilters, setStatusFilters] = useState((searchParams.get('status') || '').split(',').filter(Boolean));

  useEffect(() => {
    setSelectedIds(clearOnFilterChange(selectedIds));
  }, [search, channelFilters, tagFilters, statusFilters]);

  // ------------------------------ Meta
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

  // ------------------------------ Quick replies
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuick, setShowQuick] = useState(false);
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

  useEffect(() => { setTemplateVars({}); }, [templateId]);

  useEffect(() => {
    loadQuickReplies().then((r) => setQuickReplies(Array.isArray(r?.items) ? r.items : [])).catch(() => { });
  }, []);

  // ------------------------------ Composer
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatMatches, setChatMatches] = useState([]);
  const [chatMatchIdx, setChatMatchIdx] = useState(0);
  const chatSearchRef = useRef(null);

  // drafts: troca de conversa carrega/guarda texto
  useEffect(() => { setShowQuick(false); qrVarItemRef.current = null; }, [sel]);
  useEffect(() => setShowEmoji(false), [sel]);
  useEffect(() => setShowSnippets(false), [sel]);
  useEffect(() => {
    if (sel?.id) {
      setText(loadDraft(sel.id));
      setAttachments([]); // não carrega anexos entre conversas
      setTimeout(() => { composerRef.current?.focus?.(); }, 0);
    } else {
      setText('');
      setAttachments([]);
    }
  }, [sel, loadDraft]);
  useEffect(() => {
    if (sel?.id != null) saveDraft(sel.id, text);
  }, [text, sel, saveDraft]);

  const highlight = useCallback(
    (textV = '') => {
      if (!chatSearch) return textV;
      const lower = textV.toLowerCase();
      const q = chatSearch.toLowerCase();
      const parts = [];
      let i = 0;
      while (true) {
        const idx = lower.indexOf(q, i);
        if (idx === -1) { parts.push(textV.slice(i)); break; }
        parts.push(textV.slice(i, idx));
        parts.push(<mark key={idx} className="bg-yellow-200">{textV.slice(idx, idx + q.length)}</mark>);
        i = idx + q.length;
      }
      return parts;
    },
    [chatSearch]
  );

  useEffect(() => {
    if (!chatSearch) { setChatMatches([]); setChatMatchIdx(0); return; }
    const q = chatSearch.toLowerCase();
    const arr = [];
    msgs.forEach((m) => {
      const tx = (m.text || '').toLowerCase();
      let idx = tx.indexOf(q);
      while (idx !== -1) { arr.push({ id: m.id }); idx = tx.indexOf(q, idx + q.length); }
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

  // ------------------------------ Painéis
  const [showInfo, setShowInfo] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, items: [], index: 0, trigger: null });

  // ------------------------------ Form cliente (+campos extras)
  const [clientForm, setClientForm] = useState({ name: '', phone_e164: '', email: '', birth_date: '', notes: '' });
  const [clientSaved, setClientSaved] = useState({ name: '', phone_e164: '', email: '', birth_date: '', notes: '' });
  const [clientErrors, setClientErrors] = useState({});
  const [clientStatus, setClientStatus] = useState('idle');
  const [clientDirty, setClientDirty] = useState(false);
  const clientTimerRef = useRef(null);

  // ------------------------------ Snippets
  const [snipState, setSnipState] = useState(() => loadSnippets());
  const [showSnippets, setShowSnippets] = useState(false);
  const [snipQuery, setSnipQuery] = useState('');
  const [snipEdit, setSnipEdit] = useState(null);
  const [snipMsg, setSnipMsg] = useState('');
  const snipBtnRef = useRef(null);

  // ------------------------------ Refs
  const msgBoxRef = useRef(null);
  const emojiRef = useRef(null);
  const quickRef = useRef(null);
  const snipRef = useRef(null);
  const composerRef = useRef(null);
  const composerBoxRef = useRef(null);
  const emojiBtnRef = useRef(null);

  // popovers estáveis
  useOutsideClose(emojiRef, () => setShowEmoji(false), [sel?.id, showEmoji], [emojiBtnRef]);
  useOutsideClose(quickRef, () => setShowQuick(false), [sel?.id, showQuick]);
  useOutsideClose(snipRef, () => setShowSnippets(false), [sel?.id, showSnippets], [snipBtnRef]);

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

  const openQuick = useCallback(() => {
    setShowQuick(true);
    setQrQuery('');
    setQrIdx(0);
    setTimeout(() => {
      const el = document.querySelector('[data-testid="qr-search"]');
      el && el.focus();
    }, 0);
  }, []);

  const closeQuick = useCallback(() => {
    setShowQuick(false);
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
      closeQuick();
      setTimeout(() => {
        const pos = before.length + content.length;
        if (composerRef.current) {
          composerRef.current.selectionStart = composerRef.current.selectionEnd = pos;
          composerRef.current.focus();
        }
      }, 0);
    },
    [text, closeQuick]
  );

  const selectQRItem = useCallback(
    (it) => {
      const vars = parseVariables(it.content || '');
      if (vars.length) {
        qrVarItemRef.current = it;
        const defaults = fillDefaultVariables(vars, sel);
        setQrVarValues(defaults);
        setShowQuick(false);
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
    try {
      if (saveQRForm.id) {
        const item = await updateQuickReply(saveQRForm.id, {
          title: saveQRForm.title,
          content: saveQRForm.content
        });
        setQuickReplies((arr) => arr.map((i) => (String(i.id) === String(item.id) ? item : i)));
      } else {
        const item = await saveQuickReply({
          title: saveQRForm.title,
          content: saveQRForm.content
        });
        setQuickReplies((arr) => [...arr, item]);
      }
      setShowSaveQR(false);
    } catch (err) {
      // fallback local
      const local = {
        id: saveQRForm.id || `local-${Date.now()}`,
        title: saveQRForm.title,
        content: saveQRForm.content,
        scope: 'personal'
      };
      setQuickReplies((arr) => {
        if (saveQRForm.id) {
          return arr.map((i) => (String(i.id) === String(local.id) ? local : i));
        }
        return [...arr, local];
      });
      setShowSaveQR(false);
    }
  }, [saveQRForm]);

  const handleDeleteQR = useCallback(async (id) => {
    try { await deleteQuickReply(id); } catch { }
    setQuickReplies((arr) => arr.filter((i) => String(i.id) !== String(id)));
  }, []);

  // ------------------------------ Sincroniza URL -> estado
  useEffect(() => {
    const s = searchParams.get('search') || searchParams.get('q') || '';
    if (s !== search) setSearch(s);
    const ch = (searchParams.get('channels') || searchParams.get('channel') || '')
      .split(',').filter(Boolean);
    if (ch.join(',') !== channelFilters.join(',')) setChannelFilters(ch);
    const tg = (searchParams.get('tags') || '').split(',').filter(Boolean);
    if (tg.join(',') !== tagFilters.join(',')) setTagFilters(tg);
    const st = (searchParams.get('status') || '').split(',').filter(Boolean);
    if (st.join(',') !== statusFilters.join(',')) setStatusFilters(st);
  }, [searchParams]);

  // ------------------------------ Meta: tags/status
  useEffect(() => {
    inboxApi.get('/tags').then(r => setTags(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => { });
  }, []);
  useEffect(() => {
    inboxApi.get('/crm/statuses').then(r => setStatuses(Array.isArray(r?.data?.items) ? r.data.items : [])).catch(() => { });
  }, []);

  // ----------------------------------------------------------------- paginação da lista (lado esquerdo)
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

  // ----------------------------------------------------------------- busca e sincroniza URL
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

  // ----------------------------------------------------------------- filtro local (fallback)
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

  // ----------------------------------------------------------------- virtualização e scroll lista
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

  useLayoutEffect(() => { handleConvScroll(); }, []); // inicial
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
      entries.forEach((e) => { if (e.isIntersecting) loadMoreConversations(); });
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

  // ----------------------------------------------------------------- abrir conversa
  const open = useCallback(async (c) => {
    setShowEmoji(false);
    setSel(c);
    setCacheHit(false);
    setCacheRefreshing(false);
    markRead(c.id);
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
        markRead(c.id);
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
        markRead(c.id);
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

  // ----------------------------------------------------------------- carregar mensagens antigas (scroll topo)
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
      entries.forEach((e) => { if (e.isIntersecting) loadOlderMessages(); });
    }, { root });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadOlderMessages, sel, msgs.length]);

  // ----------------------------------------------------------------- socket (inclui typing)
  useEffect(() => {
    const s = makeSocket();

    const onConnect = () => mountedRef.current && setConnected(true);
    const onDisconnect = () => mountedRef.current && setConnected(false);

    const startTyping = (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id || payload?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      setTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 3000);
    };

    const onNew = (payload) => {
      const convId =
        payload?.conversationId ||
        payload?.conversation_id ||
        payload?.conversation?.id;

      const raw = payload?.message ?? payload?.data ?? payload;
      const msg = normalizeMessage(raw);
      if (!msg) return;

      if (sel?.id && String(sel.id) === String(convId)) {
        setMsgs(prev => ([...(prev || []), msg]));
        markRead(sel.id);
      } else {
        setItems(prev =>
          (prev || []).map(c =>
            String(c.id) === String(convId)
              ? { ...c, unread_count: (c.unread_count || 0) + 1 }
              : c
          )
        );
      }
    };

    const onUpdate = (payload) => {
      const convId =
        payload?.conversationId ||
        payload?.conversation_id ||
        payload?.conversation?.id;

      const raw = payload?.message ?? payload?.data ?? payload;
      const msg = normalizeMessage(raw);
      if (!msg) return;

      if (sel?.id && String(sel.id) === String(convId)) {
        setMsgs(prev => prev.map(m => (m.id === msg.id ? msg : m)));
      }
    };

    const onConvUpdated = (payload) => {
      const conv = payload?.conversation;
      if (!conv?.id) return;
      setItems(prev => (prev || []).map(c => (c.id === conv.id ? { ...c, ...conv } : c)));
      if (sel?.id && sel.id === conv.id) setSel(prev => ({ ...prev, ...conv }));
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('message:new', onNew);
    s.on('message:updated', onUpdate);
    s.on('conversation:updated', onConvUpdated);

    // eventos de digitação (nomes variam por integração)
    s.on('typing', startTyping);
    s.on('message:typing', startTyping);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('message:new', onNew);
      s.off('message:updated', onUpdate);
      s.off('conversation:updated', onConvUpdated);
      s.off('typing', startTyping);
      s.off('message:typing', startTyping);
    };
  }, [sel?.id]);

  // ----------------------------------------------------------------- atalhos de teclado diversos
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

  // ----------------------------------------------------------------- separador de "novas mensagens"
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

  // ----------------------------------------------------------------- drag & drop global
  useEffect(() => {
    const onDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    const onDrop = (e) => {
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [sel]);

  // ----------------------------------------------------------------- upload + preview local (com dedupe)
  async function handleFiles(fileList) {
    if (!sel) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // valida: só bloqueia por tamanho
    const valid = [];
    files.forEach((f) => {
      if (exceedsSize?.(f)) {
        const mb = Math.round((f.size / (1024 * 1024)) * 10) / 10;
        const max = MAX_UPLOAD_MB || 25;
        addToast(`Arquivo muito grande (${mb}MB). Máximo permitido: ${max}MB.`, { variant: 'error' });
      } else {
        valid.push(f);
      }
    });
    if (!valid.length) return;

    // deduplica por (name+size)
    const keyOf = (f) => `${f.name}#${f.size}`;
    const existing = new Set(
      (attachments || []).map((a) =>
        a.localFile ? keyOf(a.localFile) : `${a.filename || a.name}#${a.size || 0}`
      )
    );

    const locals = valid
      .filter((f) => !existing.has(keyOf(f)))
      .map((f) => {
        const localUrl = URL.createObjectURL(f);
        return {
          id: 'local-' + (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
          name: f.name,
          localFile: f,
          localUrl,
          isImage: /^image\//.test(f.type)
        };
      });

    if (!locals.length) return;
    setAttachments((prev) => [...prev, ...locals]);
  }

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.localUrl) URL.revokeObjectURL(item.localUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  // sobe anexos locais e normaliza retorno
  const uploadLocalAttachments = useCallback(async (convId) => {
    const locals = attachments.filter((a) => a.localFile && !a.error);
    if (!locals.length) return [];

    const uploadedAssets = [];
    for (const a of locals) {
      const form = new FormData();
      form.append('files[]', a.localFile);
      try {
        const { data } = await inboxApi.post(`/conversations/${convId}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        let assetsRaw = [];
        if (Array.isArray(data?.assets)) assetsRaw = data.assets;
        else if (Array.isArray(data?.items)) assetsRaw = data.items;
        else if (Array.isArray(data?.files)) assetsRaw = data.files;
        else if (data?.asset || data?.file) assetsRaw = [data.asset || data.file];
        else if (Array.isArray(data)) assetsRaw = data;

        const normalized = assetsRaw.map((asset) => ({
          id: asset.id || asset.asset_id || asset.file_id || asset.url,
          url: safeApiUrl(asset.url || asset.preview_url || asset.thumb_url),
          thumb_url: safeApiUrl(asset.thumb_url || asset.preview_url),
          filename: asset.filename || asset.name || a.name,
          mime: asset.mime_type || asset.content_type || asset.type || a.localFile?.type
        }));

        setAttachments((prev) =>
          prev
            .filter((x) => x.id !== a.id)
            .concat(
              normalized.map((na) => ({
                id: na.id,
                url: na.url,
                thumb_url: na.thumb_url,
                filename: na.filename,
                mime: na.mime
              }))
            )
        );
        uploadedAssets.push(...normalized);

        if (a.localUrl) URL.revokeObjectURL(a.localUrl);
      } catch (err) {
        setAttachments((prev) => prev.map((x) => (x.id === a.id ? { ...x, error: true } : x)));
        addToast(`Falha ao enviar arquivo ${a.name}`, { variant: 'error' });
      }
    }
    return uploadedAssets;
  }, [attachments]);

  // ----------------------------------------------------------------- helpers de envio com fallback
  function normalizeOutgoingPayload(payload) {
    if (payload?.type === 'file') {
      const ids = payload.attachments || payload.attachments_ids || payload.files || [];
      return [
        { ...payload }, // como veio
        { type: 'file', attachments: ids },
        { type: 'file', attachments_ids: ids },
        { files: ids },
      ];
    }
    if (payload?.type === 'template') {
      return [
        payload,
        { type: 'template', template_id: payload.template_id, variables: payload.variables || {} },
        { template_id: payload.template_id, variables: payload.variables || {} },
      ];
    }
    // texto
    return [
      payload,
      { type: 'text', text: payload.text || '' },
      { text: payload.text || '' },
    ];
  }

  async function postMessageWithFallback(convId, payload, tempId) {
    const shapes = normalizeOutgoingPayload(payload);
    const tries = [];
    for (const p of shapes) {
      tries.push(() => inboxApi.post(`/conversations/${convId}/messages`, { ...p, temp_id: tempId }));
      tries.push(() => inboxApi.post(`/inbox/conversations/${convId}/messages`, { ...p, temp_id: tempId }));
    }
    let lastErr;
    for (const fn of tries) {
      try { return await fn(); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // ----------------------------------------------------------------- envio/reenvio (VERSÃO ÚNICA — sem duplicações)
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

  const renderTemplatePreview = (tpl, vars = {}) => {
    const body = tpl?.body || tpl?.text || '';
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
  };

  const send = async () => {
    if (!sel) return;
    setShowEmoji(false);
    setShowQuick(false);

    // 1) sobe anexos locais
    const uploadedNow = await uploadLocalAttachments(sel.id);

    // 2) pega anexos prontos (inclui recém-subidos)
    const alreadyReady = attachments.filter((a) => !a.error && !a.localFile && a.id);
    const allReady = [...alreadyReady, ...uploadedNow];

    let payload = null;
    if (allReady.length) {
      payload = { type: 'file', attachments: allReady.map((a) => a.id) };
    } else if (templateId) {
      const vars = { ...templateVars };
      const errs = {};
      selectedTemplate?.variables?.forEach((v) => { if (v.required && !vars[v.key]) errs[v.key] = 'Obrigatório'; });
      setTemplateErrors(errs);
      if (Object.keys(errs).length) {
        if (!text.trim()) return; // nenhum conteúdo válido
      } else {
        payload = { type: 'template', template_id: templateId, variables: vars };
      }
    }

    if (!payload && text.trim()) payload = { type: 'text', text: text.trim() };
    if (!payload) return;

    const tempId = `temp:${Date.now()}:${Math.random()}`;
    const base = normalizeMessage({
      id: tempId,
      temp_id: tempId,
      type: payload.type || 'text',
      text:
        payload.type === 'template'
          ? renderTemplatePreview(selectedTemplate, payload.variables || {})
          : payload.text || '',
      is_outbound: true,
      from: 'agent',
      attachments:
        payload.type === 'file'
          ? allReady.map((a) => ({
              id: a.id,
              url: a.url,
              thumb_url: a.thumb_url,
              filename: a.filename || a.name,
              mime: a.mime,
            }))
          : [],
      created_at: new Date().toISOString(),
    });
    setMsgs((prev) => [...(prev || []), { ...base, sending: true }]);
    stickToBottomRef.current = true;

    try {
      const res = await postMessageWithFallback(sel.id, payload, tempId);
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
      setText(''); saveDraft(sel.id, '');
      setTemplateId(''); setTemplateVars({}); setTemplateErrors({}); setAttachments([]); setShowEmoji(false);
    } catch (e) {
      console.error('Falha ao enviar', e);
      markFailed(tempId);
      auditlog.append(sel.id, { kind: 'message', action: 'failed', meta: { type: payload.type } });
    }
  };

  const resend = async (m) => {
    if (!sel) return;
    let payload;
    if (m.type === 'file') payload = { type: 'file', attachments: (m.attachments || []).map((a) => a.id) };
    else if (m.type === 'template') payload = { type: 'template', template_id: m.template_id, variables: m.variables };
    else payload = { type: 'text', text: m.text };
    setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, failed: false, sending: true } : x)));
    try {
      const res = await postMessageWithFallback(sel.id, payload, m.id);
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

  // ------------------------------ edição rápida do cliente (header)
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
        date_of_birth: client.date_of_birth || client.birth_date || null,
        notes: client.notes || client.other_info || '',
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

  // ------------------------------ Tags / Status / IA / CRM
  const toggleClientTag = async (tagId) => {
    if (!sel?.contact?.id) return;
    const current = Array.isArray(sel.contact.tags) ? sel.contact.tags : [];
    const next = current.includes(tagId) ? current.filter(t => t !== tagId) : [...current, tagId];
    setSel(prev => ({ ...prev, contact: { ...(prev?.contact || {}), tags: next } }));
    try {
      const { data } = await inboxApi.put(`/clients/${sel.contact.id}/tags`, { tags: next });
      const client = data?.client || data;
      setSel(prev => ({ ...prev, contact: client || prev?.contact }));
    } catch (e) {
      setSel(prev => ({ ...prev, contact: { ...(prev?.contact || {}), tags: current } }));
      console.error('Falha ao atualizar tags do cliente', e);
    }
  };

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

  const createOpportunity = async () => {
    if (!sel?.contact) return;
    try {
      const payload = { client_id: sel.contact.id, conversation_id: sel.id };
      const { data } = await inboxApi.post('/crm/opportunities', payload);
      addToast('Oportunidade criada no CRM', { variant: 'success' });
      if (!sel.status_id && statuses[0]?.id) changeStatus(asId(statuses[0].id));
    } catch (e) {
      console.error('Falha ao criar oportunidade', e);
      addToast('Erro ao criar oportunidade', { variant: 'error' });
    }
  };

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
      clientForm.email !== clientSaved.email ||
      clientForm.birth_date !== clientSaved.birth_date ||
      clientForm.notes !== clientSaved.notes;
    setClientDirty(dirty);
  }, [clientForm, clientSaved, validateClient]);

  useEffect(() => {
    if (sel?.is_group) return;
    if (!clientDirty) return;
    if (Object.keys(clientErrors).length) return;
    setClientStatus('saving');
    if (clientTimerRef.current) clearTimeout(clientTimerRef.current);
    const payload = {
      name: clientForm.name,
      phone_e164: clientForm.phone_e164,
      email: clientForm.email,
      date_of_birth: clientForm.birth_date ? fromDateInput(clientForm.birth_date) : null,
      notes: clientForm.notes || '',
    };
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
          birth_date: toDateInput(client.date_of_birth || client.birth_date) || '',
          notes: client.notes || client.other_info || '',
        };
        setClientSaved(normalized);
        setClientForm(normalized);
        setSel((prevSel) => (prevSel ? { ...prevSel, contact: { ...(prevSel.contact || {}), ...client } } : prevSel));
        setItems((prevItems) =>
          (prevItems || []).map((c) => (c.id === sel.id ? { ...c, contact: { ...(c.contact || {}), ...client } } : c))
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
    const after = text.slice(0, start) === text.slice(0, end) ? text.slice(end) : text.slice(end);
    const newText = before + content + after;
    setText(newText);
    const pos = start + content.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
    setShowSnippets(false);
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

  // habilita envio quando há anexos prontos/locais mesmo com template inválido
  const hasValidAttachments = attachments.some((a) => !a.error);
  const composerDisabled =
    savingClient ||
    (templateId && Object.keys(templateErrors).length > 0 && !hasValidAttachments && !text.trim());

  const visibleItems = filteredItems.slice(convVirt.start, convVirt.end);
  const visibleIds = visibleItems.map((c) => c.id);
  const orderedIds = filteredItems.map((c) => c.id);

  // ------------------------------------------------------------- Render
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

      {/* LAYOUT */}
      <div className="h-full min-h-0 grid grid-cols-[320px_1fr_360px] overflow-hidden bg-gray-50">
        {/* ESQUERDA */}
        <div className="border-r bg-white flex flex-col min-h-0 overflow-hidden">
          {/* cabeçalho fixo */}
          <div className="p-3 border-b shrink-0">
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
                    onChange={(e) =>
                      setChannelFilters((prev) => (e.target.checked ? [...prev, ch] : prev.filter((c) => c !== ch)))
                    }
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

          {/* lista com rolagem própria */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
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

        {/* Coluna CENTRAL */}
        <div className="flex flex-col min-h-0 bg-gray-100 overflow-hidden">
          {/* Header */}
          <div className="h-14 bg-white border-b px-4 flex items-center justify-between shrink-0">
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
                        {sel?.contact?.id ? 'Salvar' : 'Criar'}
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

          <div className="bg-white border-b p-2 text-right shrink-0">
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
            <div className="p-2 border-b flex items-center gap-2 bg-white shrink-0">
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

          {sel && (
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-4 py-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Tags do cliente:</span>
                {tags.map((t) => {
                  const active = !!sel?.contact?.tags?.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleClientTag(t.id)}
                      className={`px-2 py-0.5 rounded text-xs border ${active ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                        }`}
                      title={active ? 'Remover tag' : 'Adicionar tag'}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MENSAGENS */}
          <div
            ref={msgBoxRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 min-h-0"
            data-testid="messages-container"
          >
            <div ref={topTriggerRef} data-testid="infinite-trigger-top" />
            <div style={{ height: virt.topSpacer }} />
            {(loadingMoreMsgs || loadingMsgs) && (
              <div className="text-sm text-gray-500">Carregando…</div>
            )}
            {msgs.slice(virt.start, virt.end).map((m, i) => {
              const idx = virt.start + i;
              const isAgent = m.is_outbound || m.from === 'agent' || m.author === 'agent';
              return (
                <React.Fragment key={m.id}>
                  {idx === separatorIdx && (<hr data-testid="new-messages-separator" />)}
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
                    className={`mb-2 max-w-[70%] ${density === 'compact' ? 'p-1 text-sm' : 'p-2'} rounded ${!isAgent ? 'bg-white self-start' : 'bg-blue-100 self-end ml-auto'}`}
                  >
                    {m.text && <div className="whitespace-pre-wrap">{highlight(m.text)}</div>}

                    {!!m.attachments?.length && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {m.attachments.map((a) => {
                          const href = a.url || a.preview_url || '#';
                          const thumb = a.thumb_url || a.preview_url || a.url;
                          const img = isImage(thumb);
                          const open = (e) => {
                            if (img) {
                              e.preventDefault();
                              const imgs = m.attachments
                                .filter((x) => isImage(x.url || x.thumb_url || x.preview_url))
                                .map((x) => ({ src: x.url || x.thumb_url || x.preview_url }));
                              const ix = imgs.findIndex((x) => x.src === (a.url || a.thumb_url || a.preview_url));
                              setLightbox({ open: true, items: imgs, index: ix >= 0 ? ix : 0, trigger: e.currentTarget });
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
                              download={img ? undefined : ''}
                            >
                              {img ? (
                                <img src={thumb} alt="file" className="w-28 h-28 object-cover rounded" />
                              ) : (
                                <span className="flex items-center gap-1 underline text-sm">📄 {a.filename || a.name || 'arquivo'}</span>
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
                      {isAgent && (m.sent_at || m.delivered_at || m.read_at) ? (
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
              className="bg-white border-t p-3 shrink-0"
              ref={composerBoxRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
              data-testid="composer-dropzone"
            >
              {!!attachments.length && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((a) => {
                    const src = a.thumb_url || a.url || a.preview_url || a.localUrl;
                    const isImg = a.isImage || isImage(src || '');
                    return (
                      <div key={a.id} className="relative" data-testid="pending-attachment">
                        {src ? (
                          isImg ? (
                            <img
                              src={src}
                              alt="att"
                              className={`w-14 h-14 object-cover rounded ${a.error ? 'border border-red-600' : ''}`}
                            />
                          ) : (
                            <div
                              className={`w-14 h-14 flex items-center justify-center bg-gray-200 rounded text-[10px] text-center px-1 ${a.error ? 'border border-red-600' : ''}`}
                              title={a.name || a.filename}
                            >
                              {a.name || a.filename || 'arquivo'}
                            </div>
                          )
                        ) : (
                          <div className="w-14 h-14 flex items-center justify-center bg-gray-200 rounded text-[10px]">
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
                    );
                  })}
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
                        className={`border rounded px-2 py-1 text-sm w-full ${templateErrors[v.key] ? 'border-red-500' : ''}`}
                        placeholder={v.key}
                        aria-label={v.key}
                        data-testid={`template-var-${v.key}`}
                      />
                      {templateErrors[v.key] && (
                        <div className="text-[11px] text-red-600">{templateErrors[v.key]}</div>
                      )}
                    </div>
                  ))}
                  <div className="text-sm text-gray-700 whitespace-pre-wrap" data-testid="template-preview">
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
                      if (showQuick) closeQuick(); else openQuick();
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
                    onClick={() => setShowSnippets((v) => !v)}
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
                      onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                      data-testid="composer-file-input"
                    />
                  </label>

                  {!sel?.is_group && !!templates.length && (
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
                        <EmojiPicker onSelect={(e) => { setText((t) => t + e); setShowEmoji(false); }} />
                      ) : (
                        <div className="flex gap-2 text-xl">
                          {['😀', '😅', '😍', '👍', '🙏', '🎉', '🔥', '🥳'].map((em) => (
                            <button key={em} onClick={() => { setText((t) => t + em); setShowEmoji(false); }}>{em}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {showQuick && (
                    <div
                      ref={quickRef}
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
                          if (e.key === 'Escape') { e.preventDefault(); closeQuick(); }
                        }}
                        className="border rounded px-1 py-0.5 w-full mb-2"
                      />
                      <div className="max-h-64 overflow-y-auto">
                        {searchQuickReplies(quickReplies, qrQuery).slice(0, 8).map((it, i) => (
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

                  {showSnippets && (
                    <div
                      ref={snipRef}
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
                            setShowSnippets(false);
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
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                        e.preventDefault(); setShowSnippets((v) => !v); return;
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                        e.preventDefault();
                        if (showQuick) closeQuick();
                        else {
                          qrStartRef.current = composerRef.current?.selectionStart ?? text.length;
                          openQuick();
                        }
                        return;
                      }
                      if (e.key === '/' && !showQuick) {
                        const pos = composerRef.current?.selectionStart ?? 0;
                        const before = text.slice(0, pos);
                        if (pos === 0 || /\s$/.test(before)) {
                          qrStartRef.current = pos;
                          openQuick();
                        }
                      }
                      if (e.key === 'Escape' && showQuick) { e.preventDefault(); closeQuick(); }
                      if (e.key === 'Escape' && showSnippets) {
                        e.preventDefault(); setShowSnippets(false); snipBtnRef.current?.focus();
                      }
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    onPaste={(e) => {
                      if (e.clipboardData?.files?.length) {
                        handleFiles(e.clipboardData.files);
                        e.preventDefault();
                      }
                    }}
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

        {/* Coluna DIREITA */}
        <div className={`border-l bg-white flex flex-col min-h-0 ${showInfo ? '' : 'hidden xl:block'}`}>
          <div className="flex border-b text-sm shrink-0">
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

          {sel && (
            <div className="mb-3 p-4 border-b">
              <button
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                onClick={async () => {
                  try {
                    const { data } = await inboxApi.post(`/conversations/${sel.id}/crm/enter-funnel`);
                    addToast('Enviado para o funil', { variant: 'success' });
                    if (!sel.status_id && statuses[0]?.id) changeStatus(asId(statuses[0].id));
                  } catch {
                    if (statuses[0]?.id) {
                      await changeStatus(asId(statuses[0].id));
                      addToast('Enviado para o funil (status inicial aplicado)', { variant: 'success' });
                    } else {
                      addToast('Não foi possível enviar para o funil (sem status configurado)', { variant: 'error' });
                    }
                  }
                }}
              >
                Enviar para o funil
              </button>
            </div>
          )}

          <div className="p-4 flex-1 min-h-0 overflow-y-auto">
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
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={createOpportunity}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                        data-testid="crm-create-opportunity"
                        title="Enviar para o funil do CRM"
                      >
                        Criar oportunidade no CRM
                      </button>
                      <a
                        href="/crm/oportunidades"
                        className="text-xs px-2 py-1 rounded border"
                        title="Abrir funil"
                      >
                        Abrir funil
                      </a>
                    </div>
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

                  <label className="block text-xs text-gray-500">Data de nascimento</label>
                  <input
                    type="date"
                    value={clientForm.birth_date}
                    onChange={(e) => handleClientChange('birth_date', e.target.value)}
                    disabled={sel.is_group}
                    className="w-full border rounded px-2 py-1"
                    data-testid="contact-birthdate"
                  />

                  <label className="block text-xs text-gray-500">Outras informações</label>
                  <textarea
                    value={clientForm.notes}
                    onChange={(e) => handleClientChange('notes', e.target.value)}
                    disabled={sel.is_group}
                    className="w-full border rounded px-2 py-1 h-40 max-h-64 overflow-auto"
                    data-testid="contact-notes"
                  />

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

                <div className="text-xs text-gray-500 mt-4">
                  Última atividade: {sel?.updated_at ? new Date(sel.updated_at).toLocaleString() : '-'}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Selecione uma conversa</div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox.open && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => {
            const trigger = lightbox.trigger;
            setLightbox({ open: false, items: [], index: 0, trigger: null });
            if (trigger && typeof trigger.focus === 'function') trigger.focus();
          }}
        />
      )}

      {/* Quick reply: variáveis */}
      { (typeof window !== 'undefined') && ( (() => qrVarItemRef.current)() ) && (
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

      {/* Editor de snippet */}
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

      {/* Salvar resposta rápida */}
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

      {cacheHit && <div data-testid="cache-hit" hidden />}
      {cacheRefreshing && <div data-testid="cache-refreshing" hidden />}
      <div data-testid="prefetch-log" hidden>{preloadLog}</div>
      <ToastHost />
    </>
  );
}
