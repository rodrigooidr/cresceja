import channelIconBySlug from "./channelIcons";

test("retorna ícone conhecido", () => {
  expect(channelIconBySlug.whatsapp).toBe("🟢");
});

test("fallback para default", () => {
  const slug = "desconhecido";
  expect(channelIconBySlug[slug] || channelIconBySlug.default).toBe("💭");
});
