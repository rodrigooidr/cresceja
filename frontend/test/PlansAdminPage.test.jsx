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
import App from "../src/App.jsx";

test("Sidebar aparece em /admin/plans", () => {
  renderWithProviders(<App />, { route: "/admin/plans" });
  expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /Planos \(Admin\)/i })
  ).toBeInTheDocument();
});
