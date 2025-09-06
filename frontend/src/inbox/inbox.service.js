// src/inbox/inbox.service.js
import inboxApi from 'api/inboxApi';

/**
 * Lista conversas: aceita resposta como array puro OU { items: [...] }.
 * Mantém os mesmos parâmetros e ordenação do seu código original.
 */
export async function listConversations(
  { status, channel, tags, q, limit = 50, cursor } = {}
) {
  const params = {};
  if (status) params.status = status;
  if (channel) params.channel = channel;
  if (tags?.length) params.tags = tags.join(',');
  if (q) params.q = q;
  if (limit) params.limit = limit;
  if (cursor) params.cursor = cursor;

  const { data } = await inboxApi.get('/inbox/conversations', { params });

  // Suporta os dois formatos: array puro OU { items: [...] }
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

  // Normalização leve para a UI (sem quebrar nada existente)
  const items = rows.map((r) => ({
    ...r,
    last_message_at: r.last_message_at ?? r.updated_at ?? r.created_at ?? null,
    channel: r.channel ?? r.provider ?? 'whatsapp',
    unread: r.unread ?? r.unread_count ?? 0,
    contact_name: r.contact_name ?? r.customer_name ?? r.name ?? 'Cliente',
  }));

  // Mesma ordenação que você já tinha
  items.sort((a, b) => {
    const aLast = new Date(a?.last_message_at || 0).getTime();
    const bLast = new Date(b?.last_message_at || 0).getTime();
    if (bLast !== aLast) return bLast - aLast;
    const aUpd = new Date(a?.updated_at || 0).getTime();
    const bUpd = new Date(b?.updated_at || 0).getTime();
    if (bUpd !== aUpd) return bUpd - aUpd;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });

  // Mantém compatibilidade com quem espera objeto com items
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, items };
  }
  // Se o backend devolver array puro:
  return { items, total: items.length };
}

/**
 * Busca mensagens de uma conversa.
 * Retorna o payload do backend (ex.: { items, total }).
 */
export async function getMessages(conversationId, { limit = 50 } = {}) {
  const { data } = await inboxApi.get(
    `/inbox/conversations/${conversationId}/messages`,
    { params: { limit } }
  );

  // aceita { items: [...] } ou array puro
  const rows = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  const items = rows.map((m) => {
    // tenta deduzir a origem
    let from = m.from ?? m.sender;
    if (!from) {
      if (m.direction === 'outbound') from = 'agent';
      else if (m.direction === 'inbound') from = 'contact';
      else if (m.author_id && m.author_id !== 'contact') from = 'agent';
      else from = 'contact';
    }

    const direction = m.direction ?? (from === 'agent' ? 'outbound' : 'inbound');

    return {
      ...m,
      from,
      sender: m.sender ?? from,
      direction,
    };
  });

  // mantém estrutura compatível
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, items };
  }
  return { items, total: items.length };
}
/**
 * Envia mensagem (texto ou arquivo) para a conversa.
 */
export async function sendMessage({ conversationId, text, file }) {
  const trimmed = (text ?? '').trim();
  if (!trimmed && !file) return { skipped: true };

  // Envio com arquivo (multipart)
  if (file) {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    fd.append('file', file);
    if (trimmed) fd.append('message', trimmed); // só envia texto se houver
    const { data } = await inboxApi.post('/inbox/messages', fd, { _skipRewrite: true });
    return data;
  }

  // Envio de texto puro (JSON)
  const payload = { conversationId, message: trimmed };
  const { data } = await inboxApi.post('/inbox/messages', payload, { _skipRewrite: true });
  return data;
}
