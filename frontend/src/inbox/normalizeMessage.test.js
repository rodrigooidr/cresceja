import normalizeMessage from "./normalizeMessage";

describe("normalizeMessage", () => {
  it("normaliza mensagem de texto básica", () => {
    const msg = normalizeMessage({ id: "1", text: "oi", created_at: "2020-01-01" });
    expect(msg).toMatchObject({
      id: "1",
      type: "text",
      text: "oi",
      from: "customer",
      created_at: "2020-01-01",
    });
  });

  it("infere from='agent' quando é outbound", () => {
    const msg = normalizeMessage({ id: "2", text: "ok", is_outbound: true });
    expect(msg.from).toBe("agent");
  });

  it("infere from='customer' quando é inbound", () => {
    const msg = normalizeMessage({ id: "3", text: "olá", is_inbound: true });
    expect(msg.from).toBe("customer");
  });

  it("mantém attachments e áudio", () => {
    const raw = {
      id: "4",
      type: "audio",
      audio_url: "https://example.com/a.mp3",
      attachments: [{ id: "a1", url: "https://example.com/x.png", mime: "image/png" }],
    };
    const msg = normalizeMessage(raw);
    expect(msg.type).toBe("audio");
    expect(msg.audio_url).toContain("a.mp3");
    expect(msg.attachments).toHaveLength(1);
  });

  it("define id e created_at mesmo se ausentes", () => {
    const msg = normalizeMessage({ text: "sem id" });
    expect(typeof msg.id).toBe("string");
    expect(typeof msg.created_at).toBe("string");
  });

  it("mantém metadados de grupo e transcript", () => {
    const msg = normalizeMessage({
      id: "5",
      group_meta: { group_id: "g1", sender_name: "Maria" },
      transcript_text: "texto do áudio",
    });
    expect(msg.group_meta).toEqual({ group_id: "g1", sender_name: "Maria" });
    expect(msg.transcript_text).toBe("texto do áudio");
  });

  it("retorna null para entrada inválida", () => {
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeMessage(undefined)).toBeNull();
    expect(normalizeMessage("string")).toBeNull();
  });
});
