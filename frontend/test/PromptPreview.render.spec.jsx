import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PromptPreview from "@/components/ai/PromptPreview.jsx";

describe("PromptPreview", () => {
  test("renderiza preview com dados formatados e copia texto", async () => {
    const profile = {
      vertical: "Saúde",
      brandVoice: "Calmo e acolhedor",
      languages: ["pt-BR", "en-US"],
      rag: { enabled: true, topK: 3 },
      guardrails: {
        maxReplyChars: "500",
        pre: [{ type: "blockTopic", value: "desconto" }],
        post: [{ type: "maxLength", limit: 450 }],
      },
    };

    const writeText = jest.fn();
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<PromptPreview profile={profile} title="Prompt atual" />);

    expect(screen.getByText(/prompt atual/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Segmento: Saúde"));
      expect(screen.getByRole("button", { name: /copiado/i })).toBeInTheDocument();
    });

    const accordion = screen.getByText(/ver prompt/i);
    fireEvent.click(accordion);
    expect(screen.getByText(/Bloquear tópicos/i)).toBeInTheDocument();
  });
});
