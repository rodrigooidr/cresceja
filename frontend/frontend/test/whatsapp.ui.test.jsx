import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import WhatsAppInbox from "../src/pages/inbox/whatsapp/WhatsAppInbox.jsx";
import inboxApi from "../src/api/inboxApi";

describe("WhatsApp Inbox UI", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    inboxApi.__mock?.setDelay?.(40);
    // opções de recibo/tempo
    inboxApi.__mock?.waOptions?.({ readReceipts: true, autoDeliverMs: 30, autoReadMs: 60 });
  });

  it("exibe conversa e recebe mensagem inbound com delivered/read", async () => {
    render(<WhatsAppInbox transport="cloud" />);
    // injeta mensagem recebida
    inboxApi.__mock.waInjectIncoming({ chatId: "5599", text: "alô" });

    // abre conversa
    // como a lista é vazia no começo, primeiro clique simula quando a conversa existir na listagem.
    // disparo open via botão sintético: a UI cria card após first event, então espera aparecer:
    const convBtn = await screen.findByTestId("conv-5599");
    fireEvent.click(convBtn);

    // mensagem aparece
    const log = screen.getByRole("log");
    await within(log).findByText("alô");

    // status delivered/read chegam (renderizados como texto pequeno)
    await waitFor(() => expect(screen.getAllByText(/delivered|read/).length).toBeGreaterThan(0));
  });

  it("envia texto e atualiza status até read", async () => {
    render(<WhatsAppInbox transport="baileys" />);

    // cria conversa artificial abrindo history (chamamos open após mensagem de entrada)
    inboxApi.__mock.waInjectIncoming({ chatId: "5588", text: "oi" });
    const convBtn = await screen.findByTestId("conv-5588");
    fireEvent.click(convBtn);

    const composer = await screen.findByTestId("composer");
    fireEvent.change(composer, { target: { value: "resposta" } });
    fireEvent.click(screen.getByTestId("send-text"));

    // bubble otimista aparece
    const log = screen.getByRole("log");
    await within(log).findByText("resposta");

    // após timers, status deve evoluir (sent->delivered->read)
    await waitFor(() => expect(screen.getAllByText(/delivered|read/).length).toBeGreaterThan(0));
  });

  it("indicador de digitação aparece quando remoto está digitando", async () => {
    render(<WhatsAppInbox transport="cloud" />);
    inboxApi.__mock.waInjectIncoming({ chatId: "5511", text: "oi" });
    const convBtn = await screen.findByTestId("conv-5511");
    fireEvent.click(convBtn);

    // simula typing
    inboxApi.__mock.waTyping({ chatId: "5511", state: "composing" });
    await screen.findByTestId("typing");
  });

  it("markRead é acionado ao abrir conversa com mensagens não lidas", async () => {
    render(<WhatsAppInbox transport="cloud" />);
    // injeta inbound antes de abrir
    inboxApi.__mock.waInjectIncoming({ chatId: "5577", text: "ping" });
    const btn = await screen.findByTestId("conv-5577");
    fireEvent.click(btn);

    // após abrir, mock markRead emite 'read'; checamos que o status aparece como read para a última msg
    await waitFor(() => expect(screen.getAllByText(/read/).length).toBeGreaterThan(0));
  });

  it("envia mídia por URL e mostra preview", async () => {
    render(<WhatsAppInbox transport="cloud" />);
    inboxApi.__mock.waInjectIncoming({ chatId: "5566", text: "start" });
    const btn = await screen.findByTestId("conv-5566");
    fireEvent.click(btn);

    fireEvent.change(screen.getByTestId("media-url"), { target: { value: "http://x/img.png" } });
    fireEvent.click(screen.getByTestId("send-media"));

    // imagem renderiza (alt genérico)
    await screen.findByRole("img");
  });
});
