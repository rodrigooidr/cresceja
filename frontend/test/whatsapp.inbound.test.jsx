import inboxApi from "../src/api/inboxApi.js";
import { ingestCloudWebhook } from "../src/integrations/whatsapp/inbound/cloud.js";
import { ingestBaileysEvent } from "../src/integrations/whatsapp/inbound/baileys.js";

describe("WhatsApp inbound normalização + auditoria", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    inboxApi.__mock?.setDelay?.(0);
  });

  it("Cloud webhook gera eventos e registra auditoria", async () => {
    const publish = jest.fn();

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wam-1",
                    from: "5599000000000",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "olá cloud" },
                  },
                ],
                statuses: [
                  {
                    id: "wam-x",
                    recipient_id: "5599000000000",
                    status: "delivered",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                ],
                metadata: { phone_number_id: "me", display_phone_number: "5599" },
              },
            },
          ],
        },
      ],
    };

    await ingestCloudWebhook(metaPayload, { publish });

    expect(publish).toHaveBeenCalledWith(
      "wa:message",
      expect.objectContaining({ chatId: "5599000000000", text: "olá cloud", type: "text" })
    );
    expect(publish).toHaveBeenCalledWith(
      "wa:status",
      expect.objectContaining({ chatId: "5599000000000", messageId: "wam-x", status: "delivered" })
    );

    const auditLogs = inboxApi.__mock.logs();
    expect(auditLogs.some((entry) => entry.event === "whatsapp.incoming.message" && entry.payload?.transport === "cloud")).toBe(
      true
    );
    expect(auditLogs.some((entry) => entry.event === "whatsapp.status.update" && entry.payload?.messageId === "wam-x")).toBe(
      true
    );
  });

  it("Baileys eventos geram wa:message/wa:typing e registram auditoria", async () => {
    const publish = jest.fn();

    await ingestBaileysEvent(
      {
        type: "message.upsert",
        messages: [
          { key: { remoteJid: "5588000000000", id: "bai-1" }, message: { conversation: "oi baileys" } },
        ],
      },
      { publish }
    );
    await ingestBaileysEvent(
      { type: "presence.update", chatId: "5588000000000", state: "composing" },
      { publish }
    );

    expect(publish).toHaveBeenCalledWith(
      "wa:message",
      expect.objectContaining({ chatId: "5588000000000", text: "oi baileys", direction: "in" })
    );
    expect(publish).toHaveBeenCalledWith(
      "wa:typing",
      expect.objectContaining({ chatId: "5588000000000", state: "composing" })
    );

    const auditLogs = inboxApi.__mock.logs();
    expect(auditLogs.some((entry) => entry.event === "whatsapp.incoming.message" && entry.payload?.transport === "baileys")).toBe(
      true
    );
  });
});
