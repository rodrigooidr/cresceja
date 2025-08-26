// Normaliza qualquer payload de mensagem para o shape usado pela UI
export function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;

  const type = raw.type || (raw.text ? "text" : "file");
  const direction =
    raw.direction ??
    (raw.is_outbound ? "outbound" : raw.is_inbound ? "inbound" : undefined);

  const from =
    raw.from ||
    (direction === "outbound"
      ? "agent"
      : direction === "inbound"
      ? "customer"
      : "customer");

  return {
    id: raw.id || raw.message_id || `${Date.now()}-${Math.random()}`,
    type,
    text: raw.text ?? raw.body ?? "",
    from, // "customer" | "agent"
    created_at: raw.created_at || raw.timestamp || new Date().toISOString(),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    audio_url: raw.audio_url,
    transcript_text: raw.transcript_text ?? null,
    group_meta: raw.group_meta,
  };
}

export default normalizeMessage;
