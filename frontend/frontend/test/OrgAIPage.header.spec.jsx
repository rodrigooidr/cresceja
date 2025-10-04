import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import OrgAIPage from "@/pages/settings/OrgAIPage.jsx";
import { OrgContext } from "@/contexts/OrgContext.jsx";
import { ToastProvider } from "@/components/ToastHost.jsx";
import inboxApi from "@/api/inboxApi.js";

const orgContextValue = {
  selected: "org-1",
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

describe("OrgAIPage header", () => {
  beforeEach(() => {
    inboxApi.get.mockResolvedValue({ data: { vertical: "Saúde", languages: ["pt-BR"] } });
  });

  it("renderiza título e breadcrumb", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId("page-title")).toBeInTheDocument());
    expect(screen.getByTestId("page-title")).toHaveTextContent("IA da Organização");
    expect(screen.getByTestId("breadcrumb")).toHaveTextContent("Configurações");
  });
});
