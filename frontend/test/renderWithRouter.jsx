import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

export function renderWithRouter(ui, { route = "/", historyEntries = [route] } = {}) {
  return render(
    <MemoryRouter initialEntries={historyEntries}>
      {ui}
    </MemoryRouter>
  );
}
