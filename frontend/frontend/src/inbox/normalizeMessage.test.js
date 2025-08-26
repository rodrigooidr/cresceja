import normalizeMessage from "./normalizeMessage";

test("mensagem de texto básica", () => {
  const msg = normalizeMessage({ id: "1", text: "oi", created_at: "2020-01-01" });
  expect(msg).toMatchObject({ id: "1", type: "text", text: "oi", from: "customer" });
});

test("infere from=agent para outbound", () => {
  const msg = normalizeMessage({ id: "2", text: "ok", is_outbound: true });
  expect(msg.from).toBe("agent");
});

test("mantém attachments e áudio", () => {
  const msg = normalizeMessage({ id: "3", type: "audio", audio_url: "a.mp3", attachments: [{ id: "a" }] });
  expect(msg.audio_url).toBe("a.mp3");
  expect(msg.attachments).toHaveLength(1);
});

test("mantém group_meta", () => {
  const msg = normalizeMessage({ id: "4", group_meta: { group_id: "g1" } });
  expect(msg.group_meta).toEqual({ group_id: "g1" });
});
