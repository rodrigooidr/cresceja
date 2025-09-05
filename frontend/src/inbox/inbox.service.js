import inboxApi from 'api/inboxApi';

export async function listConversations({ status, channel, tags, q, limit = 50, cursor } = {}) {
  const params = {};
  if (status) params.status = status;               // 'open' | 'closed' | ...
  if (channel) params.channel = channel;            // 'whatsapp' | 'instagram' | ...
  if (tags?.length) params.tags = tags.join(',');
  if (q) params.q = q;
  if (limit) params.limit = limit;
  if (cursor) params.cursor = cursor;
  const { data } = await inboxApi.get('/inbox/conversations', { params });
  return data; // { items, total, nextCursor? }
}

export async function getMessages(conversationId, { limit = 50 } = {}) {
  const { data } = await inboxApi.get(`/inbox/conversations/${conversationId}/messages`, {
    params: { limit },
  });
  return data; // { items, total }
}

export async function sendMessage({ conversationId, text, file }) {
  if (file) {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    if (text) fd.append('text', text);
    fd.append('file', file);
    const { data } = await inboxApi.post('/inbox/messages', fd);
    return data;
  } else {
    const { data } = await inboxApi.post('/inbox/messages', { conversationId, text });
    return data;
  }
}
