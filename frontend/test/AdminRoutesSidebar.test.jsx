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

describe("admin routes render sidebar", () => {
  test("/admin/organizations", () => {
    renderWithProviders(<App />, { route: "/admin/organizations" });
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  test("/admin/plans", () => {
    renderWithProviders(<App />, { route: "/admin/plans" });
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
