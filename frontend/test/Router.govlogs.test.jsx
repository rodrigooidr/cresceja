import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "../src/routes/AppRoutes.jsx";
import inboxApi from "../src/api/inboxApi";

describe("Router – calendar -> governança", () => {
  beforeEach(() => inboxApi.__mock?.reset?.());

  it("navega para /settings/governanca via link", async () => {
    render(
      <MemoryRouter initialEntries={["/marketing/calendar"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    const link = await screen.findByTestId("go-governanca");
    fireEvent.click(link);
    // deve renderizar página de logs
    expect(await screen.findByTestId("gov-page")).toBeInTheDocument();
  });
});
