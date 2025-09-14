import React from "react";
import { screen } from "@testing-library/react";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import inboxApi from "../src/api/inboxApi";
import App from "../src/App.jsx";

test("Sidebar aparece em /admin/plans", async () => {
  inboxApi.__mockRoute('GET', '/orgs/current', () => ({ data: globalThis.__TEST_ORG__ }));
  inboxApi.__mockRoute('GET', '/plans/current', () => ({ data: {} }));
  inboxApi.__mockRoute('GET', /\/admin\/plans(\?.*)?$/, () => ({ data: [] }));
  window.history.pushState({}, '', '/admin/plans');
  renderWithRouterProviders(<App />, { withRouter: false });
  await actTick();
  expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: /Configurações do plano/i })
  ).toBeInTheDocument();
});
