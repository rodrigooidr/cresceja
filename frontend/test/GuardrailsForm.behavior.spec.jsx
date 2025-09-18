import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GuardrailsForm from "@/components/ai/GuardrailsForm.jsx";

function Wrapper({ initialValue = { maxReplyChars: "", pre: [], post: [] }, onChange }) {
  const [value, setValue] = useState(initialValue);
  return (
    <GuardrailsForm
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("GuardrailsForm", () => {
  test("ativa bloqueio de tópicos e cria termos padrão", async () => {
    const handleChange = jest.fn();
    render(<Wrapper onChange={handleChange} />);

    const toggle = screen.getByRole("switch", { name: /bloquear tópicos sensíveis/i });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: /remover preço/i })).toBeInTheDocument();
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.pre).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "blockTopic", value: expect.stringMatching(/preç/) }),
      ]),
    );
  });

  test("permite adicionar e remover termos personalizados", async () => {
    const handleChange = jest.fn();
    render(<Wrapper onChange={handleChange} />);

    const toggle = screen.getByRole("switch", { name: /bloquear tópicos sensíveis/i });
    fireEvent.click(toggle);

    const input = screen.getByPlaceholderText(/ex\.: desconto, brinde/i);
    fireEvent.change(input, { target: { value: "segredo" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remover segredo/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remover segredo/i }));

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    const terms = Array.isArray(lastCall.pre) ? lastCall.pre.map((rule) => rule.value) : [];
    expect(terms).not.toContain("segredo");
  });

  test("configura limite pós-resposta", async () => {
    const handleChange = jest.fn();
    render(<Wrapper onChange={handleChange} />);

    fireEvent.click(screen.getByRole("switch", { name: /encurtar respostas longas/i }));

    const input = await screen.findByLabelText(/limite de caracteres pós-resposta/i);
    fireEvent.change(input, { target: { value: "320" } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });

    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.post).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "maxLength", limit: 320 }),
      ]),
    );
  });
});
