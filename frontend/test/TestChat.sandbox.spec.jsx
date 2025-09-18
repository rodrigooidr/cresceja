import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ToastHost.jsx";
import TestChat from "@/components/ai/TestChat.jsx";
import inboxApi from "@/api/inboxApi.js";

describe("TestChat", () => {
  beforeEach(() => {
    inboxApi.post.mockResolvedValue({
      data: {
        reply: "Resposta simulada",
        debug: {
          tokens: 42,
          toolCalls: [{ name: "crm.lookup" }],
          contextDocs: [{ id: "doc-1", text: "Procedimento de atendimento" }],
          violations: [{ rule: "maxLength", stage: "post", details: { limit: 300 } }],
        },
      },
    });
  });

  function renderComponent() {
    return render(
      <ToastProvider>
        <TestChat orgId="org-1" draftProfile={{ vertical: "Saúde" }} />
      </ToastProvider>,
    );
  }

  test("envia mensagem de teste usando rascunho e exibe debug", async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/canal/i), { target: { value: "instagram" } });
    fireEvent.change(screen.getByLabelText(/mensagem/i), { target: { value: "Olá, quero ajuda" } });

    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    await waitFor(() => {
      expect(inboxApi.post).toHaveBeenCalledWith(
        "/orgs/org-1/ai/test",
        expect.objectContaining({
          message: "Olá, quero ajuda",
          channel: "instagram",
          useDraft: true,
          profile: expect.objectContaining({ vertical: "Saúde" }),
        }),
      );
    });

    expect(await screen.findByText(/resposta simulada/i)).toBeInTheDocument();
    expect(screen.getByText(/tokens/i).nextElementSibling.textContent).toContain("42");
    expect(screen.getByText(/crm.lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/procedimento de atendimento/i)).toBeInTheDocument();
    expect(screen.getByText(/maxLength/i)).toBeInTheDocument();
  });
});
