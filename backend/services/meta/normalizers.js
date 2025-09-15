export function mapAttachments(arr = []) {
  return arr.map((a) => ({
    type: a.type || a.mime_type,
    url: a.payload?.url || a.file_url || a.url,
  }));
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
