import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ToastHost.jsx";
import RagSourcesCard from "@/components/ai/RagSourcesCard.jsx";
import inboxApi from "@/api/inboxApi.js";

describe("RagSourcesCard", () => {
  beforeEach(() => {
    inboxApi.post.mockResolvedValue({ data: {} });
  });

  function renderComponent() {
    return render(
      <ToastProvider>
        <RagSourcesCard orgId="org-1" />
      </ToastProvider>,
    );
  }

  test("envia arquivo para ingestão", async () => {
    renderComponent();

    const fileInput = screen.getByLabelText(/upload de arquivo/i);
    const file = new File(["conteúdo"], "manual.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(inboxApi.post).toHaveBeenCalledWith(
        "/orgs/org-1/kb/ingest",
        expect.any(FormData),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });
  });

  test("envia URL para ingestão", async () => {
    renderComponent();

    const urlInput = screen.getByLabelText(/adicionar url/i);
    fireEvent.change(urlInput, { target: { value: "https://docs.exemplo" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar url/i }));

    await waitFor(() => {
      expect(inboxApi.post).toHaveBeenCalledWith(
        "/orgs/org-1/kb/ingest",
        { url: "https://docs.exemplo" },
      );
    });
  });

  test("aciona reindexação", async () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /reindexar/i }));

    await waitFor(() => {
      expect(inboxApi.post).toHaveBeenCalledWith("/orgs/org-1/kb/reindex");
    });
  });
});
