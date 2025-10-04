import { audit } from "../../../lib/audit.js";

export async function ingestBaileysEvent(evt, { publish } = {}) {
  if (!evt || !evt.type) return;
  const emit = typeof publish === "function" ? publish : () => {};

  if (evt.type === "message.upsert") {
    for (const mx of evt.messages || []) {
      const chatId = mx?.key?.remoteJid;
      const text = mx?.message?.conversation || mx?.message?.extendedTextMessage?.text || "";
      const norm = {
        id: mx?.key?.id || `wai-${Date.now()}`,
        chatId,
        from: chatId,
        to: "me",
        direction: "in",
        type: "text",
        text,
        media: null,
        timestamp: Date.now(),
        status: "sent",
        context: null,
      };
      await audit("whatsapp.incoming.message", { transport: "baileys", chatId, type: "text" });
      emit("wa:message", norm);
    }
    return;
  }

  if (evt.type === "messages.update") {
    for (const u of evt.updates || []) {
      const map = {
        DELIVERY_ACK: "delivered",
        READ: "read",
        PENDING: "sent",
        ERROR: "failed",
      };
      const normalized = {
        chatId: u?.key?.remoteJid,
        messageId: u?.key?.id,
        status: map[u?.status] || "sent",
        timestamp: Date.now(),
        error: u?.status === "ERROR" ? { message: "error" } : null,
      };
      await audit("whatsapp.status.update", { transport: "baileys", ...normalized });
      emit("wa:status", normalized);
    }
    return;
  }

  if (evt.type === "presence.update") {
    const t = {
      chatId: evt.chatId,
      from: evt.chatId,
      state: evt.state || "composing",
      timestamp: Date.now(),
    };
    await audit("whatsapp.typing", { transport: "baileys", chatId: t.chatId, state: t.state });
    emit("wa:typing", t);
  }
}
