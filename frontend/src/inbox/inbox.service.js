// src/inbox/inbox.service.js
import inboxApi from '../api/inboxApi';

/**
 * Lista conversas: aceita resposta como array puro OU { items: [...] }.
 * Mantém os mesmos parâmetros e ordenação do seu código original.
 */
export async function listConversations(
  { status, channel, accountId, account_id, tags, q, limit = 50, cursor } = {}
) {
  const params = {};
  if (status) params.status = status;
  if (channel) params.channel = channel;
  const accId = accountId || account_id;
  if (accId) params.accountId = accId;
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

/** Lista respostas rápidas disponíveis. */
export async function listQuickReplies() {
  try {
    const { data } = await inboxApi.get('/inbox/quick-replies');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
/**
 * Envia mensagem (texto ou arquivo) para a conversa.
 */
export async function sendMessage({ conversationId, text, file }) {
  const trimmed = (text ?? '').trim();
  if (!trimmed && !file) return { skipped: true };
  const fd = new FormData();
  fd.append('conversationId', conversationId);
  if (trimmed) fd.append('message', trimmed);
  if (file) fd.append('file', file);
  const { data } = await inboxApi.post('/inbox/messages', fd, { _skipRewrite: true });
  return data;
}

// IA
export async function aiDraftMessage({ conversationId, context, tone = 'neutro', language = 'pt' }) {
  const { data } = await inboxApi.post('/inbox/ai/draft', {
    conversation_id: conversationId,
    context,
    tone,
    language,
  });
  return data;
}

export async function aiSummarizeConversation({ conversationId, context }) {
  const { data } = await inboxApi.post('/inbox/ai/summarize', {
    conversation_id: conversationId,
    context,
  });
  return data;
}

export async function aiClassifyConversation({ conversationId, context }) {
  const { data } = await inboxApi.post('/inbox/ai/classify', {
    conversation_id: conversationId,
    context,
  });
  return data;
}

// Templates
export async function listTemplates({ orgId }) {
  const { data } = await inboxApi.get('/inbox/templates', { params: { org_id: orgId } });
  return data;
}

export async function createTemplate(payload) {
  const { data } = await inboxApi.post('/inbox/templates', payload);
  return data;
}

export async function updateTemplate(id, payload) {
  const { data } = await inboxApi.put(`/inbox/templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id) {
  await inboxApi.delete(`/inbox/templates/${id}`);
  return true;
}

// Agenda
export async function proposeSlots({ duration_min = 30, count = 3, tz = 'America/Sao_Paulo', start_from }) {
  const { data } = await inboxApi.post('/integrations/google/calendar/propose-slots', {
    duration_min,
    count,
    tz,
    start_from,
  });
  return data;
}

export async function createCalendarEvent({
  org_id,
  title,
  start,
  end,
  attendees = [],
  conversation_id,
}) {
  const { data } = await inboxApi.post('/integrations/google/calendar/events', {
    org_id,
    title,
    start,
    end,
    attendees,
    conversation_id,
  });
  return data;
}

export async function deleteCalendarEvent(id) {
  await inboxApi.delete(`/integrations/google/calendar/events/${id}`);
  return true;
}

export async function listCalendarLogs() {
  const { data } = await inboxApi.get('/integrations/google/calendar/logs');
  return data;
}
