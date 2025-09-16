import inboxApi from "../src/api/inboxApi.js";
import { createWhatsAppClient } from "../src/integrations/whatsapp/client/index.js";
import { fetchLogs } from "../src/lib/audit.js";

jest.setTimeout(15000);

describe("WhatsApp – retry/backoff, abort e idempotência", () => {
  beforeEach(() => {
    jest.useRealTimers();
    inboxApi.__mock?.reset?.();
    inboxApi.__mock?.setDelay?.(40);
    window.analytics = { track: jest.fn() };
  });

  afterEach(() => {
    window.analytics = undefined;
  });

  it("retries 429 até sucesso (cloud)", async () => {
    inboxApi.__mock.failNTimes(/\/whatsapp\/cloud\/send$/, 2, { status: 429 });
    const client = createWhatsAppClient({ transport: "cloud" });
    const res = await client.sendText({ to: "550000", text: "oi", chatId: "550000" });
    expect(res).toHaveProperty("id");
    const attempts = await fetchLogs({ event: "whatsapp.send.attempt" });
    const cloudAttempts = attempts.filter((a) => a.payload?.transport === "cloud");
    expect(cloudAttempts.length).toBeGreaterThanOrEqual(2);
  });

  it("respeita AbortController e audita abort", async () => {
    inboxApi.__mock.setDelay(150);
    const client = createWhatsAppClient({ transport: "baileys" });
    const controller = new AbortController();
    const promise = client.sendText({ to: "551111", text: "cancelar", chatId: "551111", signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/Abort/i);
    const logs = await fetchLogs({ event: "whatsapp.send.abort" });
    expect(logs.some((l) => l.payload?.transport === "baileys")).toBe(true);
  });

  it("encaminha Idempotency-Key (eco no mock) no sendMedia", async () => {
    const client = createWhatsAppClient({ transport: "cloud" });
    const key = "idemp-test-123";
    const msg = await client.sendMedia({
      to: "552222",
      chatId: "552222",
      media: { type: "image", url: "http://x/img.png", mime: "image/png" },
      caption: "cap",
      idempotencyKey: key,
    });
    expect(msg).toHaveProperty("id");
    const attempts = await fetchLogs({ event: "whatsapp.send.success" });
    const last = attempts.reverse().find((entry) => entry.payload?.transport === "cloud");
    expect(last?.payload?.idempotency).toBe(key);
  });
});
