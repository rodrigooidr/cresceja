// Normaliza mensagens/eventos para um shape único, independente do transporte.
export function normalizeMessage(raw) {
  // Para o mock, o raw já vem quase normalizado; garantimos campos padrão:
  return {
    id: raw.id,
    chatId: raw.chatId,
    from: raw.from,
    to: raw.to,
    direction: raw.direction || (raw.from === raw.chatId ? "in" : "out"),
    type: raw.type || "text",
    text: raw.text || "",
    media: raw.media || null, // {type, url, mime, filename, caption?}
    timestamp: raw.timestamp || Date.now(),
    status: raw.status || "sent", // queued|sent|delivered|read|failed
    context: raw.context || null, // {quotedMessageId?}
  };
}

export function normalizeStatus(raw) {
  return {
    chatId: raw.chatId,
    messageId: raw.messageId,
    status: raw.status, // queued|sent|delivered|read|failed
    timestamp: raw.timestamp || Date.now(),
    error: raw.error || null,
  };
}

export function normalizeTyping(raw) {
  return {
    chatId: raw.chatId,
    from: raw.from,
    state: raw.state, // composing|paused
    timestamp: raw.timestamp || Date.now(),
  };
}
