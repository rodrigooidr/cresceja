import React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./utils/renderWithProviders.jsx";
jest.mock("../src/contexts/AuthContext.jsx", () => ({
  __esModule: true,
  useAuth: () => ({ user: { role: "SuperAdmin" }, isAuthenticated: true }),
}));
jest.mock("../src/contexts/OrgContext.jsx", () => ({
  __esModule: true,
  useOrg: () => ({ selected: null, setSelected: () => {} }),
  OrgProvider: ({ children }) => <>{children}</>,
}));
jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));
const inboxApi = require("../src/api/inboxApi.js").default;
import App from "../src/App.jsx";

test("Sidebar aparece em /admin/plans", async () => {
  inboxApi.get.mockResolvedValue({ data: [] });
  renderWithProviders(<App />, { route: "/admin/plans" });
  expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: /Configurações do plano/i })
  ).toBeInTheDocument();
});
