import React from "react";
import { screen } from "@testing-library/react";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import App from "../src/App.jsx";

jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: [] })), post: jest.fn(() => Promise.resolve({})) }
}));

describe("Sidebar visibility and routes", () => {
  test("Organizações link visible for SuperAdmin", async () => {
    window.history.pushState({}, '', '/inbox');
    renderWithRouterProviders(<App />, { withRouter: false, user: { id: 'u1', role: 'SuperAdmin', name: 'SU' }, org: { selected: 'org1', orgs: [{ id: 'org1', name: 'Org1' }] } });
    expect(await screen.findByText("Organizações")).toBeInTheDocument();
  });

  test("Agent redirected from /admin/organizations", () => {
    window.history.pushState({}, '', '/admin/organizations');
    renderWithRouterProviders(<App />, { withRouter: false, user: { id: 'u2', role: 'Agent', name: 'Ag' }, org: { selected: 'org1', orgs: [{ id: 'org1', name: 'Org1' }] } });
    expect(window.location.pathname).toBe("/inbox");
    expect(screen.queryByText("Organizações (Assinantes)")).not.toBeInTheDocument();
  });

  test("/clients accessible when org active", async () => {
    window.history.pushState({}, '', '/clients');
    renderWithRouterProviders(<App />, { withRouter: false, user: { id: 'u3', role: 'Admin', name: 'Adm' }, org: { selected: 'org1', orgs: [{ id: 'org1', name: 'Org1' }] } });
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });
});
