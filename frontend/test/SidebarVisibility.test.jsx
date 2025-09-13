import React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./utils/renderWithProviders.jsx";
import App from "../src/App.jsx";

let mockUser = { role: "SuperAdmin" };
let mockActiveOrg = "org1";

jest.mock("../src/auth/useAuth.js", () => ({
  useAuth: () => ({ user: mockUser })
}));

jest.mock("../src/hooks/useActiveOrg.js", () => ({
  __esModule: true,
  default: () => ({ activeOrg: mockActiveOrg })
}));

jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: [] })), post: jest.fn(() => Promise.resolve({})) }
}));

describe("Sidebar visibility and routes", () => {
  test("Organizações link visible for SuperAdmin", () => {
    mockUser = { role: "SuperAdmin" };
    renderWithProviders(<App />, { route: "/inbox" });
    expect(screen.getByText("Organizações")).toBeInTheDocument();
  });

  test("Agent redirected from /admin/organizations", () => {
    mockUser = { role: "Agent" };
    renderWithProviders(<App />, { route: "/admin/organizations" });
    expect(window.location.pathname).toBe("/inbox");
    expect(screen.queryByText("Organizações (Assinantes)")).not.toBeInTheDocument();
  });

  test("/clients accessible when org active", async () => {
    mockUser = { role: "Admin" };
    mockActiveOrg = "org1";
    renderWithProviders(<App />, { route: "/clients" });
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });
});
