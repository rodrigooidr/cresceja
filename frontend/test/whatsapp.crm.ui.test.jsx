import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WhatsAppInbox from "../src/pages/inbox/whatsapp/WhatsAppInbox.jsx";
import inboxApi from "../src/api/inboxApi";

describe("WhatsApp Inbox – badges, tags, CRM, IA e transcrição", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    inboxApi.__mock?.waOptions?.({ readReceipts: true });
  });

  it("mostra badge do canal e permite adicionar tag e filtrar por tag", async () => {
    inboxApi.__mock.crmSeed({ phone: "5599", name: "Cliente 9", channel: "instagram", tags: ["vip"] });
    inboxApi.__mock.waInjectIncoming({ chatId: "5599", text: "oi" });

    render(<WhatsAppInbox transport="cloud" />);
    const btn = await screen.findByTestId("conv-5599");
    expect(btn.textContent).toMatch(/IG/);

    const input = btn.querySelector('input[data-testid="tag-input"]');
    fireEvent.change(input, { target: { value: "prioridade" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.change(screen.getByTestId("tag-filter"), { target: { value: "prio" } });
    expect(await screen.findByTestId("conv-5599")).toBeInTheDocument();
  });

  it("carrega CRM; se não existir, mostra cadastro; valida e salva", async () => {
    inboxApi.__mock.waInjectIncoming({ chatId: "5588", text: "novo" });
    render(<WhatsAppInbox transport="cloud" />);
    fireEvent.click(await screen.findByTestId("conv-5588"));

    const form = await screen.findByTestId("crm-form");
    fireEvent.click(screen.getByTestId("crm-save"));

    const [name, phone, email, birth] = form.querySelectorAll("input");
    fireEvent.change(name, { target: { value: "Fulano" } });
    fireEvent.change(phone, { target: { value: "+5588999999999" } });
    fireEvent.change(email, { target: { value: "fulano@ex.com" } });
    fireEvent.change(birth, { target: { value: "1990-01-02" } });
    fireEvent.click(screen.getByTestId("crm-save"));

    await screen.findByTestId("crm-panel");
    expect(screen.getByText("Fulano")).toBeInTheDocument();
  });

  it("IA global e por conversa (toggles visíveis)", async () => {
    inboxApi.__mock.waInjectIncoming({ chatId: "5577", text: "oi" });
    render(<WhatsAppInbox transport="cloud" />);
    fireEvent.click(await screen.findByTestId("conv-5577"));

    const labels = await screen.findAllByText(/IA /i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("transcreve áudio ao clicar 'Transcrever'", async () => {
    inboxApi.__mock.waInjectIncoming({
      chatId: "5566",
      text: "",
      type: "audio",
      media: { type: "audio", url: "http://x/audio.ogg", mime: "audio/ogg" },
    });
    render(<WhatsAppInbox transport="cloud" />);
    fireEvent.click(await screen.findByTestId("conv-5566"));
    const btns = await screen.findAllByTestId(/transcribe-/);
    fireEvent.click(btns[0]);
    await screen.findByText(/Transcrição simulada do áudio/);
  });
});
