function pickUrl(a = {}) {
  const payload = a.payload || {};
  return (
    a.remote_url ||
    a.url ||
    payload.url ||
    a.file_url ||
    a.image_url ||
    a.video_url ||
    a.sticker_url ||
    payload.sticker_url ||
    payload.file_url ||
    payload.image_url ||
    payload.video_url ||
    a.href ||
    a.link ||
    null
  );
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function guessType(type, mime) {
  if (type) return type;
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export function mapAttachments(arr = []) {
  return arr.map((a = {}) => {
    const payload = a.payload || {};
    const url = pickUrl(a);
    const mime = a.mime || a.mime_type || payload.mime_type || payload.content_type || null;
    const width =
      toNumber(a.width) ||
      toNumber(a.image_width) ||
      toNumber(a.image_data?.width) ||
      toNumber(payload.width) ||
      toNumber(payload.image_width) ||
      toNumber(payload.image_data?.width) ||
      null;
    const height =
      toNumber(a.height) ||
      toNumber(a.image_height) ||
      toNumber(a.image_data?.height) ||
      toNumber(payload.height) ||
      toNumber(payload.image_height) ||
      toNumber(payload.image_data?.height) ||
      null;
    const duration =
      toNumber(a.duration_ms) ||
      toNumber(a.duration) ||
      toNumber(a.video_length) ||
      toNumber(a.video_duration) ||
      toNumber(a.video_data?.duration_ms) ||
      toNumber(a.video_data?.duration) ||
      toNumber(payload.duration_ms) ||
      toNumber(payload.duration) ||
      null;
    const size =
      toNumber(a.size) ||
      toNumber(a.file_size) ||
      toNumber(a.bytes) ||
      toNumber(payload.size) ||
      toNumber(payload.file_size) ||
      null;
    const base = {
      type: guessType(a.type, mime),
      mime,
      size,
      remote_url: url || null,
      storage_key: a.storage_key || null,
      width,
      height,
      duration_ms: duration,
    };

    return {
      ...base,
      url: url || null,
    };
  });
}

export function normalizeMessenger(body = {}) {
  const out = [];
  for (const entry of body.entry || []) {
    const pageId = entry.id;
    for (const m of entry.messaging || []) {
      if (!m.message) continue;
      out.push({
        channel: 'facebook',
        externalAccountId: String(pageId),
        externalUserId: String(m.sender?.id),
        externalThreadId: String(m.sender?.id),
        messageId: String(m.message?.mid),
        text: m.message?.text || undefined,
        attachments: mapAttachments(m.message?.attachments || []),
        timestamp: m.timestamp || Date.now(),
        raw: m,
      });
    }
  }
  return out;
}

export function normalizeInstagram(body = {}) {
  const out = [];
  for (const entry of body.entry || []) {
    const igUserId = entry.id;
    for (const ch of entry.changes || []) {
      const val = ch.value || {};
      const msgs = val.messages || [];
      for (const msg of msgs) {
        out.push({
          channel: 'instagram',
          externalAccountId: String(igUserId),
          externalUserId: String(msg.from?.id),
          externalThreadId: String(val.thread_id || msg.thread_id || ''),
          messageId: String(msg.id),
          text: msg.text || undefined,
          attachments: mapAttachments(msg.attachments || []),
          timestamp: Number(val.timestamp) || Date.now(),
          raw: msg,
        });
      }
    }
  }
  return out;
}
