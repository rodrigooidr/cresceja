import React, { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi';
import { makeSocket } from '../../sockets/socket';

// ---------- Helpers ----------
function uuid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
}

/**
 * Normaliza qualquer formato vindo do backend/socket para o shape que a UI espera.
 * Garante sempre: { id, text, type, from: "customer"|"agent", created_at, attachments[] }
 */
function normalizeMessage(raw, { user, conversation }) {
  if (!raw || typeof raw !== 'object') return null;

  const type = raw.type || (raw.text ? 'text' : raw.message_type) || 'text';
  const text = raw.text ?? raw.body ?? raw.message ?? '';

  // Direção -> from
  // Tenta diversas pistas comuns e cai em defaults seguros.
  const direction =
    raw.direction ??
    (raw.is_outbound ? 'outbound' : raw.is_inbound ? 'inbound' : undefined);

  let from =
    raw.from ??
    raw.author ??
    raw.sender ??
    (direction === 'outbound' ? 'agent' :
     direction === 'inbound' ? 'customer' :
     undefined);

  // Se ainda não der para inferir, usa heurística por usuário/logado
  if (!from) {
    if (raw.user_id && user?.id && String(raw.user_id) === String(user.id)) {
      from = 'agent';
    } else if (raw.contact_id || raw.client_id) {
      from = 'customer';
    } else {
      // fallback pelo canal da conversa
      from = 'customer';
    }
  }

  return {
    id: raw.id ?? raw.message_id ?? uuid(),
    type,
    text,
    from, // "customer" | "agent"
    created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
}

// ---------- UI ----------
function ConversationItem({ c, onOpen }) {
  const contact = c?.contact || {};
  return (
    <button onClick={() => onOpen(c)} className="w-full px-3 py-2 hover:bg-gray-100 flex gap-3 border-b">
      <img src={contact.photo_url || 'https://placehold.co/40'} alt="avatar" className="w-10 h-10 rounded-full"/>
      <div className="text-left">
        <div className="font-medium">{contact.name || contact.phone_e164 || 'Contato'}</div>
        <div className="text-xs text-gray-500">{c?.channel || 'canal'} · {c?.status || 'status'}</div>
      </div>
    </button>
  );
}

export default function InboxPage() {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const user = getCurrentUser();

  // Carrega lista de conversas
  useEffect(() => {
    (async () => {
      try {
        const { data } = await inboxApi.get('/conversations');
        const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        setItems(arr);
      } catch (e) {
        console.error('Falha ao carregar conversas', e);
      }
    })();
  }, []);

  // Socket: novas mensagens
  useEffect(() => {
    const s = makeSocket();

    s.on('message:new', (payload) => {
      // Aceita vários formatos de payload
      const convId = payload?.conversationId || payload?.conversation_id || payload?.conversation?.id || payload?.conversationIdOverride;
      if (!sel?.id || String(sel.id) !== String(convId)) return;

      const raw = payload?.message ?? payload?.data ?? payload;
      const normalized = normalizeMessage(raw, { user, conversation: sel });
      if (!normalized) return;

      setMsgs((prev) => [normalized, ...(prev || [])].filter(Boolean));
    });

    return () => {
      try { s.close?.(); } catch { /* noop */ }
      try { s.disconnect?.(); } catch { /* noop */ }
    };
  }, [sel, user]);

  // Abre conversa e carrega mensagens
  const open = async (c) => {
    try {
      setSel(c);
      const { data } = await inboxApi.get(`/conversations/${c.id}/messages`);
      const raw = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      const safe = raw.map((m) => normalizeMessage(m, { user, conversation: c })).filter(Boolean);
      setMsgs(safe);
    } catch (e) {
      console.error('Falha ao carregar mensagens', e);
      setMsgs([]);
    }
  };

  // Envia mensagem
  const send = async () => {
    if (!sel || !text.trim()) return;

    try {
      const res = await inboxApi.post(`/conversations/${sel.id}/messages`, { type: 'text', text: text.trim() });
      // cobre { message: {...} }, { data: {...} } ou {...}
      const createdRaw = res?.data?.message ?? res?.data?.data ?? res?.data;
      const created = normalizeMessage(createdRaw, { user, conversation: sel });

      if (!created) {
        console.warn('Resposta inesperada do servidor ao enviar mensagem:', res?.data);
        return;
      }

      setMsgs((prev) => [created, ...(prev || [])].filter(Boolean));
      setText('');
    } catch (e) {
      console.error('Falha ao enviar mensagem', e);
    }
  };

  const safeMsgs = (Array.isArray(msgs) ? msgs : []).filter(Boolean);

  return (
    <div className="grid grid-cols-12 h-[calc(100vh-80px)]">
      {/* Coluna esquerda */}
      <div className="col-span-3 border-r overflow-y-auto">
        <div className="p-2">
          <input placeholder="Buscar..." className="w-full border rounded px-3 py-2" />
        </div>
        {(items || []).map((c) => (
          <ConversationItem key={c.id} c={c} onOpen={open} />
        ))}
      </div>

      {/* Coluna central */}
      <div className="col-span-6 flex flex-col">
        <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 gap-2">
          {safeMsgs.map((m) => (
            <div
              key={m.id}
              className={`max-w-[70%] p-2 rounded ${m.from === 'customer' ? 'bg-gray-100 self-start' : 'bg-blue-100 self-end'}`}
              title={new Date(m.created_at).toLocaleString()}
            >
              {m.text || <em>[{m.type}]</em>}
            </div>
          ))}
        </div>
        {sel && (
          <div className="p-3 border-t flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => (e.key === 'Enter' && !e.shiftKey ? send() : null)}
              placeholder="Digite..."
              className="flex-1 border rounded px-3 py-2"
            />
            <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded">
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
              <img src={sel?.contact?.photo_url || 'https://placehold.co/56'} alt="avatar" className="w-14 h-14 rounded-full" />
              <div>
                <div className="font-semibold">{sel?.contact?.name || 'Contato'}</div>
                <div className="text-sm text-gray-500">{sel?.contact?.phone_e164 || ''}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">Canal: {sel?.channel || '-'}</div>
            <div className="text-sm text-gray-600">Status: {sel?.status || '-'}</div>
          </div>
        ) : (
          <div className="text-gray-500">Selecione uma conversa</div>
        )}
      </div>
    </div>
  );
}
