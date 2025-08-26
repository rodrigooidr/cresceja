import channelIconBySlug from "./channelIcons";

describe("channelIconBySlug", () => {
  it("retorna ícone para canal conhecido (whatsapp)", () => {
    expect(channelIconBySlug.whatsapp).toBe("🟢");
  });

  it("retorna fallback default para canal desconhecido", () => {
    const slug = "canal-que-nao-existe";
    const icon = channelIconBySlug[slug] || channelIconBySlug.default;
    expect(icon).toBe("💭");
  });

  it("possui chave default definida", () => {
    expect(channelIconBySlug.default).toBeDefined();
  });
});
