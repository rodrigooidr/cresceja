import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ViolationsList from "@/components/ai/ViolationsList.jsx";
import inboxApi from "@/api/inboxApi.js";

describe("ViolationsList", () => {
  const items = Array.from({ length: 60 }, (_, index) => ({
    id: `v${index + 1}`,
    rule: "maxLength",
    stage: index % 2 === 0 ? "post" : "pre",
    payload: { message: "texto grande", reply: "resposta" },
    created_at: "2024-05-10T12:00:00Z",
  }));

  beforeEach(() => {
    inboxApi.get.mockResolvedValue({ data: { items } });
  });

  test("carrega e exibe violações", async () => {
    render(<ViolationsList orgId="org-1" />);

    expect(inboxApi.get).toHaveBeenCalledWith("/orgs/org-1/ai/violations", { params: { limit: 50 } });

    await waitFor(() => {
      expect(screen.getAllByText(/maxLength/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/texto grande/i).length).toBeGreaterThan(0);
  });

  test("permite carregar mais resultados", async () => {
    render(<ViolationsList orgId="org-1" />);

    await waitFor(() => {
      expect(screen.getAllByText(/maxLength/i).length).toBeGreaterThan(0);
    });
    const loadMore = await waitFor(() => screen.getByRole("button", { name: /carregar mais/i }));
    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(inboxApi.get).toHaveBeenLastCalledWith("/orgs/org-1/ai/violations", { params: { limit: 100 } });
    });
  });
});
