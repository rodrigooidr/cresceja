import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { makeSocket } from '../../sockets/socket';
import normalizeMessage from '../../inbox/normalizeMessage';
import channelIconBySlug from '../../inbox/channelIcons';
import EmojiPicker from '../../components/inbox/EmojiPicker.jsx';
import inboxApi from '../../api/inboxApi';
import { apiUrl } from '../../utils/apiUrl';

// ---------- Consts ----------
const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  // backend costuma usar 'messenger' (exibe "Facebook")
  { value: 'messenger', label: 'Facebook' },
];

// ---------- UI ----------
function ConversationItem({ c, onOpen }) {
  const contact = c?.contact || {};
  const icon = channelIconBySlug[c?.channel] || channelIconBySlug.default;
  const photo = contact.photo_url ? apiUrl(contact.photo_url) : 'https://placehold.co/40';
  return (
    <button onClick={() => onOpen(c)} className="w-full px-3 py-2 hover:bg-gray-100 flex gap-3 border-b">
      <img src={photo} alt="avatar" className="w-10 h-10 rounded-full"/>
      <div className="text-left min-w-0">
        <div className="font-medium flex items-center gap-1 truncate">
          <span className="truncate">{contact.name || contact.phone_e164 || 'Contato'}</span>
          <span className="text-xs shrink-0">{icon}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">{c?.status || 'status'}</div>
      </div>
    </button>
  );
}

export default function InboxPage() {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState([]); // {id,url,thumb_url}
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone_e164: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [channelFilters, setChannelFilters] = useState(
    searchParams.get('channels') ? searchParams.get('channels').split(',') : []
  );
  const [tagFilters, setTagFilters] = useState(
    searchParams.get('tags') ? searchParams.get('tags').split(',') : []
  );
  const [statusFilters, setStatusFilters] = useState(
    searchParams.get('status') ? searchParams.get('status').split(',') : []
  );

  const [tags, setTags] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // Carrega tags e statuses disponíveis
  useEffect(() => {
    inboxApi
      .get('/tags')
      .then((r) => setTags(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => {});
    inboxApi
      .get('/crm/statuses')
      .then((r) => setStatuses(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => {});
  }, []);

  // Carrega templates quando conversa muda
  useEffect(() => {
    if (!sel) {
      setTemplates([]);
      setTemplateId('');
      setClientForm({ name: '', phone_e164: '' });
      return;
    }
    // formulário do cliente
    setClientForm({
      name: sel?.contact?.name || '',
      phone_e164: sel?.contact?.phone_e164 || '',
    });

    if (sel.is_group) {
      setTemplates([]);
      setTemplateId('');
      return;
    }
    inboxApi
      .get('/templates', { params: { channel: sel.channel } })
      .then((r) => setTemplates(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => setTemplates([]));
  }, [sel]);

  // Monta objeto de params a partir do estado
  const queryParams = useMemo(() => {
    const p = {};
    if (search) p.search = search;
    if (channelFilters.length) p.channels = channelFilters.join(',');
    if (tagFilters.length) p.tags = tagFilters.join(',');
    if (statusFilters.length) p.status = statusFilters.join(',');
    return p;
  }, [search, channelFilters, tagFilters, statusFilters]);

  // Carrega lista de conversas com filtros e debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      inboxApi
        .get('/conversations', { params: queryParams })
        .then(({ data }) => {
          const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          setItems(arr);
        })
        .catch((e) => console.error('Falha ao carregar conversas', e));
    }, 300);

    // só atualiza a URL se houve mudança real
    const current = Object.fromEntries([...searchParams.entries()]);
    const next = queryParams;
    const changed =
      Object.keys(next).length !== Object.keys(current).length ||
      Object.keys(next).some((k) => next[k] !== current[k]);
    if (changed) setSearchParams(next, { replace: true });

    return () => clearTimeout(timeout);
  }, [queryParams, searchParams, setSearchParams]);

  // Socket: mensagens e conversa atualizadas
  useEffect(() => {
    const s = makeSocket();

    s.on('message:new', (payload) => {
      const convId =
        payload?.conversationId ||
        payload?.conversation_id ||
        payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;

      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;

      setMsgs((prev) => [normalized, ...(prev || [])].filter(Boolean));
    });

    s.on('message:updated', (payload) => {
      const convId =
        payload?.conversationId ||
        payload?.conversation_id ||
        payload?.conversation?.id;
      if (!sel?.id || String(sel.id) !== String(convId)) return;

      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw);
      if (!normalized) return;

      setMsgs((prev) => prev.map((m) => (m.id === normalized.id ? normalized : m)));
    });

    s.on('conversation:updated', (payload) => {
      const conv = payload?.conversation;
      if (!conv?.id) return;
      setItems((prev) => prev.map((c) => (c.id === conv.id ? conv : c)));
      if (sel?.id === conv.id) setSel((prev) => ({ ...prev, ...conv }));
    });

    return () => {
      try { s.close?.(); } catch {}
      try { s.disconnect?.(); } catch {}
    };
  }, [sel]);

  // Abre conversa e carrega mensagens
  const open = async (c) => {
    try {
      setSel(c);
      const { data } = await inboxApi.get(`/conversations/${c.id}/messages`);
      const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const safe = raw.map((m) => normalizeMessage(m)).filter(Boolean);
      setMsgs(safe);
    } catch (e) {
      console.error('Falha ao carregar mensagens', e);
      setMsgs([]);
    }
  };

  // Upload de anexos
  const handleFiles = async (fileList) => {
    if (!sel) return;
    const files = Array.from(fileList || []);
    const uploaded = [];
    for (const f of files) {
      const form = new FormData();
      form.append('files[]', f);
      try {
        const { data } = await inboxApi.post(
          `/conversations/${sel.id}/attachments`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const assets = Array.isArray(data?.assets)
          ? data.assets.map((a) => ({
              ...a,
              url: a.url ? apiUrl(a.url) : undefined,
              thumb_url: a.thumb_url ? apiUrl(a.thumb_url) : undefined,
            }))
          : [];
        uploaded.push(...assets);
      } catch (e) {
        console.error('Falha no upload', e);
      }
    }
    if (uploaded.length) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
  };

  // Envia mensagem (texto, template ou arquivo)
  const send = async () => {
    if (!sel) return;
    let body = null;

    if (attachments.length) {
      body = { type: 'file', attachments: attachments.map((a) => a.id) };
    } else if (templateId) {
      body = { type: 'template', template_id: templateId, variables: {} };
    } else if (text.trim()) {
      body = { type: 'text', text: text.trim() };
    } else {
      return;
    }

    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, body);
      const createdRaw = res?.data?.message ?? res?.data?.data ?? res?.data;
      const created = normalizeMessage(createdRaw);
      if (!created) {
        console.warn('Resposta inesperada do servidor ao enviar mensagem:', res?.data);
        return;
      }
      setMsgs((prev) => [created, ...(prev || [])].filter(Boolean));
      setText('');
      setTemplateId('');
      setAttachments([]);
    } catch (e) {
      console.error('Falha ao enviar mensagem', e);
    }
  };

  // Atualiza tags da conversa
  const toggleTag = async (tagId) => {
    if (!sel) return;
    const current = Array.isArray(sel.tags) ? sel.tags : [];
    const newTags = current.includes(tagId)
      ? current.filter((t) => t !== tagId)
      : [...current, tagId];
    setSel((prev) => ({ ...prev, tags: newTags }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/tags`, { tags: newTags });
      const conv = data?.conversation || data;
      setSel(conv);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) {
      console.error('Falha ao atualizar tags', e);
    }
  };

  // Atualiza status CRM
  const changeStatus = async (statusId) => {
    if (!sel) return;
    setSel((prev) => ({ ...prev, status_id: statusId }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/crm-status`, {
        status_id: statusId || null,
      });
      const conv = data?.conversation || data;
      setSel(conv);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) {
      console.error('Falha ao atualizar status', e);
    }
  };

  // Toggle IA
  const toggleAi = async () => {
    if (!sel) return;
    const enabled = !sel.ai_enabled;
    setSel((prev) => ({ ...prev, ai_enabled: enabled }));
    try {
      const { data } = await inboxApi.put(`/conversations/${sel.id}/ai`, { enabled });
      const conv = data?.conversation || data;
      setSel(conv);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? conv : c)));
    } catch (e) {
      console.error('Falha ao alternar IA', e);
    }
  };

  // Salva/atualiza cliente
  const saveClient = async () => {
    if (!sel || sel.is_group) return;
    try {
      let res;
      if (sel.contact?.id) {
        res = await inboxApi.put(`/clients/${sel.contact.id}`, clientForm);
      } else {
        res = await inboxApi.post('/clients', clientForm);
      }
      const client = res?.data?.client || res?.data;
      setSel((prev) => ({ ...prev, contact: client }));
    } catch (e) {
      console.error('Falha ao salvar cliente', e);
    }
  };

  const safeMsgs = (Array.isArray(msgs) ? msgs : []).filter(Boolean);

  return (
    <div className="grid grid-cols-12 h-[calc(100vh-80px)]">
      {/* Coluna esquerda */}
      <div className="col-span-3 border-r overflow-y-auto">
        <div className="p-2 flex flex-col gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full border rounded px-3 py-2"
          />
          <div className="flex gap-3 flex-wrap text-sm">
            {CHANNEL_OPTIONS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={channelFilters.includes(value)}
                  onChange={(e) =>
                    setChannelFilters((prev) =>
                      e.target.checked ? [...prev, value] : prev.filter((c) => c !== value)
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {tags.length > 0 && (
            <select
              multiple
              value={tagFilters}
              onChange={(e) =>
                setTagFilters(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="border rounded px-2 py-1 text-sm"
            >
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {statuses.length > 0 && (
            <select
              multiple
              value={statusFilters}
              onChange={(e) =>
                setStatusFilters(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="border rounded px-2 py-1 text-sm"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {(items || []).map((c) => (
          <ConversationItem key={c.id} c={c} onOpen={open} />
        ))}
      </div>

      {/* Coluna central */}
      <div className="col-span-6 flex flex-col">
        <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 gap-2">
          {safeMsgs.map((m) => {
            const when = new Date(m.created_at);
            const title = when.toLocaleString();
            const short = when.toLocaleTimeString();
            return (
              <div
                key={m.id}
                className={`max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-gray-100 self-start' : 'bg-blue-100 self-end'}`}
                title={title}
              >
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}

                {m.attachments?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {m.attachments.map((a) => {
                      const hasUrl = !!a?.url;
                      const thumb = a?.thumb_url || a?.url;
                      const imgEl = thumb ? (
                        <img
                          src={thumb}
                          alt="file"
                          className="w-24 h-24 object-cover rounded"
                        />
                      ) : (
                        <span className="underline text-sm">arquivo</span>
                      );
                      return hasUrl ? (
                        <a key={a.id || a.url} href={a.url} target="_blank" rel="noreferrer">
                          {imgEl}
                        </a>
                      ) : (
                        <div key={a.id || Math.random()}>{imgEl}</div>
                      );
                    })}
                  </div>
                )}

                {m.type === 'audio' && m.audio_url && (
                  <div className="mt-1">
                    <audio controls src={m.audio_url} className="w-48" />
                    <div className="text-xs text-gray-500 mt-1">
                      {m.transcript_text ? m.transcript_text : 'Transcrevendo...'}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-gray-500 mt-1 text-right">{short}</div>
              </div>
            );
          })}
        </div>

        {sel && (
          <div className={`p-3 border-t flex flex-col gap-2 ${expanded ? 'h-[40vh]' : ''}`}>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="relative">
                    <img
                      src={a.thumb_url || a.url}
                      alt="att"
                      className="w-16 h-16 object-cover rounded"
                    />
                  </div>
                ))}
              </div>
            )}
            {showEmoji && <EmojiPicker onSelect={(e) => setText((t) => t + e)} />}
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEmoji((v) => !v)} className="px-2" disabled={sel.is_group}>
                😊
              </button>
              {!sel.is_group && templates.length > 0 && (
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  <option value="">Template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="file"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                disabled={!sel}
              />
              <button onClick={() => setExpanded((e) => !e)} className="px-2">
                {expanded ? '↙' : '↗'}
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null)}
              placeholder="Digite..."
              className="flex-1 border rounded px-3 py-2 resize-none"
              style={{ maxHeight: expanded ? '40vh' : '6em' }}
            />
            <button onClick={send} className="self-end px-4 py-2 bg-blue-600 text-white rounded">
              Enviar
            </button>
          </div>
        )}
      </div>

      {/* Coluna direita */}
      <div className="col-span-3 border-l p-4">
        {sel ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src={sel?.contact?.photo_url ? apiUrl(sel.contact.photo_url) : 'https://placehold.co/56'}
                alt="avatar"
                className="w-14 h-14 rounded-full"
              />
              <div>
                <div className="font-semibold flex items-center gap-1">
                  <span>{sel?.contact?.name || 'Contato'}</span>
                  <span className="text-xs">{channelIconBySlug[sel?.channel] || channelIconBySlug.default}</span>
                </div>
                <div className="text-sm text-gray-500">{sel?.contact?.phone_e164 || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!sel.ai_enabled}
                  onChange={toggleAi}
                  disabled={sel.is_group}
                />
                IA
              </label>
              {statuses.length > 0 && (
                <select
                  value={sel.status_id || ''}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">Sem status</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    sel.tags?.includes(t.id) ? 'bg-blue-200' : 'bg-gray-200'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-600">Canal: {sel?.channel || '-'}</div>
            <div className="text-xs text-gray-500 mt-1">
              Última atividade: {sel?.updated_at ? new Date(sel.updated_at).toLocaleString() : '-'}
            </div>
            {sel.is_group && (
              <div className="text-xs text-red-500 mt-2">Conversa em grupo – IA e cliente desabilitados</div>
            )}
            {!sel.is_group && (
              <div className="mt-3 space-y-2 text-sm">
                <input
                  value={clientForm.name}
                  onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome"
                  className="w-full border rounded px-2 py-1"
                />
                <input
                  value={clientForm.phone_e164}
                  onChange={(e) => setClientForm((f) => ({ ...f, phone_e164: e.target.value }))}
                  placeholder="Telefone"
                  className="w-full border rounded px-2 py-1"
                />
                <button onClick={saveClient} className="px-2 py-1 bg-blue-600 text-white rounded">
                  {sel.contact?.id ? 'Salvar' : 'Criar'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500">Selecione uma conversa</div>
        )}
      </div>
    </div>
  );
}
