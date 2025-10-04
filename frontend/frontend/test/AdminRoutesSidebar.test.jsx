import React from "react";
import { screen } from "@testing-library/react";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import App from "../src/App.jsx";

describe("admin routes render sidebar", () => {
  test("/admin/organizations", () => {
    window.history.pushState({}, '', '/admin/organizations');
    renderWithRouterProviders(<App />, { withRouter: false });
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  test("/admin/plans", () => {
    window.history.pushState({}, '', '/admin/plans');
    renderWithRouterProviders(<App />, { withRouter: false });
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
