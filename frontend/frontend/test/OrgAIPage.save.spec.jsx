import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrgAIPage from "@/pages/settings/OrgAIPage.jsx";
import { OrgContext } from "@/contexts/OrgContext.jsx";
import { ToastProvider } from "@/components/ToastHost.jsx";
import inboxApi from "@/api/inboxApi.js";

const orgContextValue = {
  selected: "org-77",
  publicMode: false,
};

function renderPage() {
  return render(
    <ToastProvider>
      <OrgContext.Provider value={orgContextValue}>
        <OrgAIPage />
      </OrgContext.Provider>
    </ToastProvider>
  );
}

describe("OrgAIPage save", () => {
  it("envia PUT com os dados atualizados", async () => {
    inboxApi.get.mockResolvedValueOnce({
      data: {
        vertical: "Saúde",
        brandVoice: "Tom inicial",
        languages: ["pt-BR"],
        rag: { enabled: false, topK: 5 },
        guardrails: { maxReplyChars: 200 },
      },
    });
    inboxApi.put.mockResolvedValueOnce({
      data: {
        vertical: "Saúde",
        brandVoice: "Tom atualizado",
        languages: ["pt-BR", "es-ES"],
        rag: { enabled: false, topK: 5 },
        guardrails: { maxReplyChars: 300 },
      },
    });

    renderPage();

    const brandVoiceField = await screen.findByLabelText(/Tom da marca/i);
    fireEvent.change(brandVoiceField, { target: { value: "Tom atualizado" } });

    const languagesField = screen.getByLabelText(/Idiomas aceitos/i);
    fireEvent.change(languagesField, { target: { value: "pt-BR, es-ES" } });

    const maxCharsField = screen.getByLabelText(/Tamanho máximo/i);
    fireEvent.change(maxCharsField, { target: { value: "300" } });

    fireEvent.click(screen.getByTestId("orgai-save"));

    await waitFor(() => {
      expect(inboxApi.put).toHaveBeenCalledWith(
        "/orgs/org-77/ai-profile",
        expect.objectContaining({
          brandVoice: "Tom atualizado",
          languages: ["pt-BR", "es-ES"],
          guardrails: expect.objectContaining({ maxReplyChars: 300 }),
          rag: expect.objectContaining({ enabled: false, topK: 5 }),
        }),
      );
    });
  });
});
