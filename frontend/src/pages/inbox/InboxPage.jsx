import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import inboxApi, { apiUrl } from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';
import normalizeMessage from '../../inbox/normalizeMessage';
import channelIconBySlug from '../../inbox/channelIcons';
import EmojiPicker from '../../components/inbox/EmojiPicker.jsx';
import Lightbox from '../../components/inbox/Lightbox.jsx';

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
        <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full h-fit">{c.unread_count}</span>
      ) : null}
    </button>
  );
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado base ----------------------------------------------------------
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

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
  const [showEmoji, setShowEmoji] = useState(false);

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

  // Busca conversas + sincroniza URL ------------------------------------
  useEffect(() => {
    const params = {};
    if (search) params.q = search;
    if (search) params.search = search;
    if (channelFilters.length) params.channels = channelFilters.join(',');
    if (tagFilters.length) params.tags = tagFilters.join(',');
    if (statusFilters.length) params.status = statusFilters.join(',');

    setLoadingList(true);
    const t = setTimeout(async () => {
      try {
        const r = await firstOk([
          () => inboxApi.get('/inbox/conversations', { params }),
          () => inboxApi.get('/conversations', { params }),
        ]);
        const arr = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
        setItems(arr);
      } catch (e) {
        console.error('Falha ao obter conversas', e);
      } finally {
        setLoadingList(false);
      }
    }, 300);

    setSearchParams(params, { replace: true });
    return () => clearTimeout(t);
  }, [search, channelFilters, tagFilters, statusFilters, setSearchParams]);

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

  // Socket ---------------------------------------------------------------
  useEffect(() => {
    const s = makeSocket();

    s.on('message:new', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
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
      setTimeout(() => { msgBoxRef.current && (msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight); }, 0);
    });

    s.on('message:updated', (payload) => {
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;
      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;
      setMsgs((prev) => (prev || []).map((m) => (m.id === normalized.id ? normalized : m)));
    });

    s.on('conversation:updated', (payload) => {
      const conv = payload?.conversation;
      if (!conv?.id) return;
      setItems((prev) => (prev || []).map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
      if (sel?.id === conv.id) setSel((prev) => ({ ...prev, ...conv }));
    });

    return () => { try { s.close?.(); } catch {} try { s.disconnect?.(); } catch {} };
  }, [sel]);

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
      setTimeout(() => { msgBoxRef.current && (msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight); }, 0);
    } catch (e) {
      console.error('Falha ao carregar mensagens', e);
      setMsgs([]);
    } finally { setLoadingMsgs(false); }
  }, []);

  // Upload ---------------------------------------------------------------
  const handleFiles = async (fileList) => {
    if (!sel) return;
    const files = Array.from(fileList || []);
    const uploaded = [];
    for (const f of files) {
      const form = new FormData();
      form.append('files[]', f);
      try {
        const { data } = await inboxApi.post(`/conversations/${sel.id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const assets = Array.isArray(data?.assets) ? data.assets.map((a) => ({ ...a, url: apiUrl(a.url), thumb_url: apiUrl(a.thumb_url) })) : [];
        uploaded.push(...assets);
      } catch (e) { console.error('Falha no upload', e); }
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
    setTimeout(() => { msgBoxRef.current && (msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight); }, 0);

    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, { ...payload, temp_id: tempId });
      const createdRaw = res?.data?.message ?? res?.data?.data ?? res?.data;
      const created = normalizeMessage(createdRaw);
      if (created) replaceTemp(tempId, created); else markFailed(tempId);
      setText(''); setTemplateId(''); setTemplateVars({}); setTemplateErrors({}); setAttachments([]);
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
    <div className="grid grid-cols-12 h-[calc(100vh-80px)] bg-gray-50">
      {/* Sidebar (esquerda) */}
      <div className="col-span-3 border-r bg-white flex flex-col">
        <div className="p-3 border-b">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="w-full border rounded-full px-4 py-2 text-sm"
            data-testid="filter-search"
          />
          <div className="mt-2 flex gap-2 text-xs flex-wrap">
            {['whatsapp', 'instagram', 'facebook'].map((ch) => (
              <label key={ch} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                <input
                  type="checkbox"
                  checked={channelFilters.includes(ch)}
                  onChange={(e) => setChannelFilters((prev) => (e.target.checked ? [...prev, ch] : prev.filter((c) => c !== ch)))}
                  data-testid={`filter-channel-${ch}`}
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
                data-testid="filter-tags"
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
                data-testid="filter-status"
              >
                {statuses.map((s) => (
                  <option key={asId(s.id)} value={asId(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-3 text-sm text-gray-500" data-testid="loading">Carregando…</div>
          ) : filteredItems.length ? (
            filteredItems.map((c) => (
              <ConversationItem key={c.id} c={c} onOpen={open} active={sel?.id === c.id} />
            ))
          ) : (
            <div className="p-3 text-sm text-gray-500" data-testid="empty">Nenhuma conversa.</div>
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
            <button className="text-sm" onClick={() => setShowInfo((v) => !v)} title="Detalhes">ℹ️</button>
          </div>
        </div>

        {/* Mensagens */}
        <div ref={msgBoxRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingMsgs && <div className="text-sm text-gray-500">Carregando…</div>}
          {(msgs || []).map((m) => (
            <div
              key={m.id}
              data-testid={m.failed ? 'msg-failed' : m.sending ? 'msg-sending' : undefined}
              data-status={m.failed ? 'failed' : m.sending ? 'sending' : 'sent'}
              className={`max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-white self-start' : 'bg-blue-100 self-end ml-auto'}`}
            >
              {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}

              {!!m.attachments?.length && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.attachments.map((a, i) => {
                    const href = a.url || '#';
                    const thumb = a.thumb_url || a.url;
                    const open = (e) => {
                      if (isImage(thumb)) {
                        e.preventDefault();
                        const imgs = m.attachments
                          .filter((x) => isImage(x.thumb_url || x.url))
                          .map((x) => ({ src: x.url || x.thumb_url }));
                        const idx = imgs.findIndex((x) => x.src === (a.url || a.thumb_url));
                        setLightbox({ open: true, items: imgs, index: idx >= 0 ? idx : 0, trigger: e.currentTarget });
                      }
                    };
                    return (
                      <a key={a.id || href} href={href} target="_blank" rel="noreferrer" onClick={open} data-testid="thumb">
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
                <span className="text-[10px] text-gray-500" title={new Date(m.created_at).toLocaleString()}>{formatRelative(m.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

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
              <div className="mb-2 flex flex-wrap gap-2" data-testid="pending-attachments">
                {attachments.map((a) => (
                  <div key={a.id} className="relative">
                    <img src={a.thumb_url || a.url} alt="att" className="w-14 h-14 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="absolute top-0 right-0 text-xs bg-white rounded-full px-1"
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
                {clientErrors.name && <div className="text-[11px] text-red-600">{clientErrors.name}</div>}

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
  );
}
