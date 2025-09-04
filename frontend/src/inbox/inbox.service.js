import inboxApi from '@/api/inboxApi';

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
