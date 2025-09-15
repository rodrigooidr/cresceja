import axios from 'axios';
import { normalizeMessenger, normalizeInstagram } from './normalizers.js';

const ver = process.env.META_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${ver}`;

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function normalizeSince(since) {
  if (!since) return null;
  const n = Number(since);
  if (!Number.isFinite(n)) return null;
  return n;
}

function adaptAttachment(att = {}) {
  const payload = { ...(att.payload || {}) };
  if (!payload.url) {
    payload.url =
      att.file_url ||
      att.image_url ||
      att.video_url ||
      att?.media?.image?.src ||
      att?.media?.source ||
      att?.thumbnail_url ||
      payload.sticker_url ||
      null;
  }
  if (!payload.mime_type && att.mime_type) payload.mime_type = att.mime_type;
  if (!payload.file_size && att.file_size) payload.file_size = att.file_size;
  if (!payload.width && att.image_data?.width) payload.width = att.image_data.width;
  if (!payload.height && att.image_data?.height) payload.height = att.image_data.height;
  if (!payload.duration && att.video_data?.duration) payload.duration = att.video_data.duration;
  return {
    ...att,
    payload,
  };
}

async function paginate(url, params, token, handler) {
  let nextUrl = url;
  let nextParams = params;
  while (nextUrl) {
    const { data } = await axios.get(nextUrl, { params: nextParams, headers: auth(token) });
    await handler(data || {});
    if (data?.paging?.next) {
      nextUrl = data.paging.next;
      nextParams = undefined;
    } else {
      nextUrl = null;
    }
  }
}

export async function backfillFacebook(pageId, token, since) {
  if (!pageId || !token) return [];
  const sinceMs = normalizeSince(since);
  const params = {
    fields:
      'messages.limit(50){id,from,message,text,created_time,attachments{mime_type,media_type,file_url,image_url,video_url,file_size,image_data,video_data}}',
    limit: 25,
  };
  if (sinceMs) params.since = Math.floor(sinceMs / 1000);

  const events = [];
  await paginate(`${BASE}/${pageId}/conversations`, params, token, (body) => {
    const conversations = Array.isArray(body?.data) ? body.data : [];
    for (const conv of conversations) {
      const messages = Array.isArray(conv?.messages?.data) ? conv.messages.data : [];
      const messaging = [];
      for (const msg of messages) {
        const ts = Date.parse(msg.created_time || msg.timestamp || '') || Date.now();
        if (sinceMs && ts < sinceMs) continue;
        if (!msg.from || String(msg.from.id) === String(pageId)) continue;
        messaging.push({
          sender: { id: String(msg.from.id) },
          message: {
            mid: String(msg.id),
            text: msg.message || msg.text || '',
            attachments: Array.isArray(msg.attachments?.data)
              ? msg.attachments.data.map(adaptAttachment)
              : [],
          },
          timestamp: ts,
        });
      }
      if (messaging.length) {
        const normalized = normalizeMessenger({ entry: [{ id: String(pageId), messaging }] });
        events.push(...normalized);
      }
    }
  });
  return events;
}

export async function backfillInstagram(igUserId, token, since) {
  if (!igUserId || !token) return [];
  const sinceMs = normalizeSince(since);
  const params = {
    fields:
      'messages.limit(50){id,from,text,message,created_time,attachments{mime_type,media_type,file_url,image_url,video_url,file_size,image_data,video_data}}',
    limit: 25,
  };
  if (sinceMs) params.since = Math.floor(sinceMs / 1000);

  const events = [];
  await paginate(`${BASE}/${igUserId}/conversations`, params, token, (body) => {
    const conversations = Array.isArray(body?.data) ? body.data : [];
    for (const conv of conversations) {
      const messages = Array.isArray(conv?.messages?.data) ? conv.messages.data : [];
      for (const msg of messages) {
        const ts = Date.parse(msg.created_time || msg.timestamp || '') || Date.now();
        if (sinceMs && ts < sinceMs) continue;
        if (!msg.from || String(msg.from.id) === String(igUserId)) continue;
        const normalized = normalizeInstagram({
          entry: [
            {
              id: String(igUserId),
              changes: [
                {
                  value: {
                    thread_id: conv.id || msg.thread_id || '',
                    timestamp: String(ts),
                    messages: [
                      {
                        id: String(msg.id),
                        from: { id: String(msg.from.id) },
                        text: msg.text || msg.message || '',
                        attachments: Array.isArray(msg.attachments?.data)
                          ? msg.attachments.data.map(adaptAttachment)
                          : [],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });
        events.push(...normalized);
      }
    }
  });

  return events;
}

export default { backfillFacebook, backfillInstagram };
