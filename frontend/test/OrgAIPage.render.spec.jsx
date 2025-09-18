import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import OrgAIPage from "@/pages/settings/OrgAIPage.jsx";
import { OrgContext } from "@/contexts/OrgContext.jsx";
import { ToastProvider } from "@/components/ToastHost.jsx";
import inboxApi from "@/api/inboxApi.js";

const orgContextValue = {
  selected: "org-55",
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

describe("OrgAIPage render", () => {
  it("mostra loading e depois preenche o formulário", async () => {
    inboxApi.get.mockResolvedValueOnce({
      data: {
        vertical: "Saúde",
        brandVoice: "Tom calmo e acolhedor",
        languages: ["pt-BR", "en-US"],
        rag: { enabled: true, topK: 8 },
        guardrails: { maxReplyChars: 280 },
      },
    });

    renderPage();

    expect(screen.getByTestId("orgai-loading")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByDisplayValue("Tom calmo e acolhedor")).toBeInTheDocument());

    expect(screen.queryByTestId("orgai-loading")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Saúde")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pt-BR, en-US")).toBeInTheDocument();
    expect(screen.getByDisplayValue("280")).toBeInTheDocument();
    expect(screen.getByLabelText(/RAG habilitado/i)).toBeChecked();
    const previewSection = screen.getByRole("heading", { name: /Preview/i }).closest("section");
    expect(previewSection).toBeTruthy();
    expect(within(previewSection).getByText(/Ativado/)).toBeInTheDocument();
  });
});
