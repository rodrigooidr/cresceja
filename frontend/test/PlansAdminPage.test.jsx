import React from "react";
import { screen } from "@testing-library/react";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));
const inboxApi = require("../src/api/inboxApi.js").default;
import App from "../src/App.jsx";

test("Sidebar aparece em /admin/plans", async () => {
  inboxApi.get.mockResolvedValue({ data: [] });
  window.history.pushState({}, '', '/admin/plans');
  renderWithRouterProviders(<App />, { withRouter: false });
  expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: /Configurações do plano/i })
  ).toBeInTheDocument();
});
