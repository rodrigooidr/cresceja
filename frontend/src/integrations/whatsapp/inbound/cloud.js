import { audit } from "../../../lib/audit.js";

export async function ingestCloudWebhook(payload, { publish } = {}) {
  const emit = typeof publish === "function" ? publish : () => {};
  const entries = payload?.entry || [];
  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};

      const msgs = value?.messages || [];
      for (const m of msgs) {
        const chatId = m?.from || value?.metadata?.display_phone_number || "";
        const base = {
          id: m?.id,
          chatId,
          from: m?.from,
          to: value?.metadata?.phone_number_id || undefined,
          direction: "in",
          timestamp: m?.timestamp ? Number(m.timestamp) * 1000 : Date.now(),
          status: "sent",
          context: m?.context ? { quotedMessageId: m.context.id } : null,
        };

        let norm;
        if (m?.type === "text") {
          norm = { ...base, type: "text", text: m?.text?.body || "", media: null };
        } else if (m?.type === "image") {
          norm = {
            ...base,
            type: "image",
            text: m?.caption || "",
            media: { type: "image", url: m?.image?.id || "", mime: "image/*", filename: "" },
          };
        } else if (m?.type === "document") {
          norm = {
            ...base,
            type: "document",
            text: m?.caption || "",
            media: {
              type: "document",
              url: m?.document?.id || "",
              mime: m?.document?.mime_type,
              filename: m?.document?.filename,
            },
          };
        } else {
          norm = { ...base, type: m?.type || "unknown", text: "", media: null };
        }

        await audit("whatsapp.incoming.message", { transport: "cloud", chatId: norm.chatId, type: norm.type });
        emit("wa:message", norm);
      }

      const stats = value?.statuses || [];
      for (const s of stats) {
        const statusMap = { delivered: "delivered", read: "read", sent: "sent", failed: "failed" };
        const normalized = {
          chatId: s?.recipient_id,
          messageId: s?.id,
          status: statusMap[s?.status] || s?.status || "sent",
          timestamp: s?.timestamp ? Number(s.timestamp) * 1000 : Date.now(),
          error: s?.errors?.[0]?.title ? { message: s.errors[0].title } : null,
        };
        await audit("whatsapp.status.update", { transport: "cloud", ...normalized });
        emit("wa:status", normalized);
      }
    }
  }
}
