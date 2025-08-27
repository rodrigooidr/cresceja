import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import inboxApi, { apiUrl } from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';
import normalizeMessage from '../../inbox/normalizeMessage';
import channelIconBySlug from '../../inbox/channelIcons';
import EmojiPicker from '../../components/inbox/EmojiPicker.jsx';

// Utilidades -------------------------------------------------------------
const isImage = (u = '') => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(String(u || ''));
const asId = (v) => (v === 0 ? '0' : v ? String(v) : '');
const uniqBy = (arr, keyFn) => {
  const m = new Map();
  arr.forEach((x) => m.set(keyFn(x), x));
  return Array.from(m.values());
};

async function firstOk(fns = []) {
  for (const fn of fns) {
    try { const r = await fn(); if (r?.data) return r; } catch (_) {}
  }
  throw new Error('Nenhum endpoint respondeu');
}

// Lightbox simples -------------------------------------------------------
function Lightbox({ open, src, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <img
        src={src}
        alt="preview"
        className="max-w-[92vw] max-h-[88vh] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
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

  // Composer ------------------------------------------------------------
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);

  // Painéis -------------------------------------------------------------
  const [showInfo, setShowInfo] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, src: '' });

  // Form cliente --------------------------------------------------------
  const [clientForm, setClientForm] = useState({ name: '', phone_e164: '' });
  const [clientErrors, setClientErrors] = useState({});

  // Refs ----------------------------------------------------------------
  const msgBoxRef = useRef(null);
  const emojiRef = useRef(null);

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
      }
    }, 220);

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
      setMsgs((prev) => uniqBy([...(prev || []), normalized], (m) => m.id));
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

  // Envio otimista -------------------------------------------------------
  const replaceTemp = (id, real) => setMsgs((p) => (p || []).map((m) => (m.id === id ? real : m)));
  const markFailed = (id) => setMsgs((p) => (p || []).map((m) => (m.id === id ? { ...m, failed: true } : m)));

  const send = async () => {
    if (!sel) return;
    let payload = null;
    if (attachments.length) payload = { type: 'file', attachments: attachments.map((a) => a.id) };
    else if (templateId) payload = { type: 'template', template_id: templateId, template: templateId, variables: {} };
    else if (text.trim()) payload = { type: 'text', text: text.trim() };
    else return;

    const tempId = `temp:${Date.now()}:${Math.random()}`;
    const optimistic = normalizeMessage({ id: tempId, type: payload.type || 'text', text: payload.text || '', is_outbound: true, attachments: (payload.attachments || []).map((id) => attachments.find((a) => a.id === id)), created_at: new Date().toISOString() });
    setMsgs((prev) => [...(prev || []), optimistic]);
    setTimeout(() => { msgBoxRef.current && (msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight); }, 0);

    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, payload);
      const createdRaw = res?.data?.message ?? res?.data?.data ?? res?.data;
      const created = normalizeMessage(createdRaw);
      if (created) replaceTemp(tempId, created); else markFailed(tempId);
      setText(''); setTemplateId(''); setAttachments([]);
    } catch (e) { console.error('Falha ao enviar', e); markFailed(tempId); }
  };

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
    if (f.name && f.name.trim().length < 2) errs.name = 'Nome muito curto';
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
          />
          <div className="mt-2 flex gap-2 text-xs flex-wrap">
            {['whatsapp', 'instagram', 'facebook'].map((ch) => (
              <label key={ch} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                <input
                  type="checkbox"
                  checked={channelFilters.includes(ch)}
                  onChange={(e) => setChannelFilters((prev) => (e.target.checked ? [...prev, ch] : prev.filter((c) => c !== ch)))}
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
              >
                {statuses.map((s) => (
                  <option key={asId(s.id)} value={asId(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredItems.map((c) => (
            <ConversationItem key={c.id} c={c} onOpen={open} active={sel?.id === c.id} />
          ))}
          {!filteredItems.length && <div className="p-3 text-sm text-gray-500">Nenhuma conversa.</div>}
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
            {!sel?.is_group && (
              <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" checked={!!sel?.ai_enabled} onChange={toggleAi} /> IA
              </label>
            )}
            <button className="text-sm" onClick={() => setShowInfo((v) => !v)} title="Detalhes">ℹ️</button>
          </div>
        </div>

        {/* Mensagens */}
        <div ref={msgBoxRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingMsgs && <div className="text-sm text-gray-500">Carregando…</div>}
          {(msgs || []).map((m) => (
            <div
              key={m.id}
              className={`max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-white self-start' : 'bg-blue-100 self-end ml-auto'}`}
            >
              {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}

              {!!m.attachments?.length && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.attachments.map((a) => {
                    const href = a.url || '#';
                    const thumb = a.thumb_url || a.url;
                    const open = (e) => {
                      if (isImage(thumb)) { e.preventDefault(); setLightbox({ open: true, src: thumb }); }
                    };
                    return (
                      <a key={a.id || href} href={href} target="_blank" rel="noreferrer" onClick={open}>
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
                {m.failed && <span className="text-[10px] text-red-600">Falhou</span>}
                <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        {sel && (
          <div className="bg-white border-t p-3">
            {!!attachments.length && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <img key={a.id} src={a.thumb_url || a.url} alt="att" className="w-14 h-14 object-cover rounded" />
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEmoji((v) => !v); }}
                  className="px-2 py-1 rounded hover:bg-gray-100"
                  title="Emojis"
                  disabled={sel.is_group}
                >
                  😊
                </button>

                <label className="px-2 py-1 rounded hover:bg-gray-100 cursor-pointer" title="Anexar">
                  📎
                  <input type="file" className="hidden" multiple onChange={(e) => handleFiles(e.target.files)} />
                </label>

                {!sel.is_group && !!templates.length && (
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
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
                  <div ref={emojiRef} className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-2 z-10">
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
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null)}
                  placeholder="Digite uma mensagem"
                  className="w-full border rounded px-3 py-2 resize-none max-h-40"
                  rows={1}
                />
              </div>

              <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded">Enviar</button>
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
      <Lightbox open={lightbox.open} src={lightbox.src} onClose={() => setLightbox({ open: false, src: '' })} />
    </div>
  );
}
