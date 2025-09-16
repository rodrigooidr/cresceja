import { createWhatsAppClient } from "../src/integrations/whatsapp/client/index.js";
import inboxApi from "../src/api/inboxApi";

beforeEach(() => {
  jest.useRealTimers();
});

function setup(transport) {
  inboxApi.__mock.reset();
  inboxApi.__mock.setDelay(20);
  const client = createWhatsAppClient({ transport });
  // pluga o bus do mock no client para eventos
  const bus = inboxApi.__mock.waBus();
  // redireciona eventos do mock para o client (emitidos pelo transport via on(...)? já escutamos direto no on)
  return { client, bus };
}

async function scenarioSendAndStatuses(client) {
  const events = [];
  const off = [
    client.on("status", (e) => events.push({ t: "status", e })),
    client.on("typing", (e) => events.push({ t: "typing", e })),
    client.on("message", (e) => events.push({ t: "message", e })),
  ];
  const msg = await client.sendText({ to: "55999999999", text: "hello", chatId: "55999999999" });
  expect(msg.type).toBe("text");
  expect(msg.status).toBe("sent");
  // aguarda delivered/read simulados
  await new Promise((r) => setTimeout(r, 120));
  // deve ter recebido delivered e read
  const statuses = events.filter((x) => x.t === "status").map((x) => x.e.status);
  expect(statuses).toEqual(expect.arrayContaining(["delivered", "read"]));
  off.forEach((fn) => fn && fn());
  return { msg, events };
}

describe("WhatsApp client parity (cloud vs baileys)", () => {
  it("envia texto, recebe status delivered/read em ambos os transportes", async () => {
    const { client: c1 } = setup("cloud");
    const { client: c2 } = setup("baileys");
    const r1 = await scenarioSendAndStatuses(c1);
    const r2 = await scenarioSendAndStatuses(c2);
    // shapes principais equivalentes (ignorando ids/timestamps)
    expect(r1.msg.type).toBe(r2.msg.type);
    expect(r1.msg.direction).toBe(r2.msg.direction);
  });

  it("markRead dispara evento de leitura", async () => {
    const { client } = setup("cloud");
    const { msg } = await scenarioSendAndStatuses(client);
    const got = [];
    const off = client.on("status", (e) => got.push(e));
    await client.markRead({ chatId: msg.chatId, messageId: msg.id });
    await new Promise((r) => setTimeout(r, 30));
    expect(got.map((x) => x.status)).toContain("read");
    off && off();
  });

  it("typing composing/paused é emitido", async () => {
    const { client } = setup("baileys");
    const got = [];
    const off = client.on("typing", (e) => got.push(e.state));
    await client.setTyping({ chatId: "55999999999", state: "composing" });
    await client.setTyping({ chatId: "55999999999", state: "paused" });
    expect(got).toEqual(expect.arrayContaining(["composing", "paused"]));
    off && off();
  });

  it("history retorna mensagens normalizadas", async () => {
    const { client } = setup("cloud");
    await client.sendText({ to: "55999999999", text: "1", chatId: "55999999999" });
    await client.sendText({ to: "55999999999", text: "2", chatId: "55999999999" });
    const hist = await client.fetchHistory({ chatId: "55999999999", limit: 2 });
    expect(hist.items.length).toBeGreaterThan(0);
    expect(hist.items[0]).toHaveProperty("id");
    expect(hist.items[0]).toHaveProperty("chatId");
  });
});
