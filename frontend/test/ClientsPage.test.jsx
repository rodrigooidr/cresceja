import React from "react";
import { screen } from "@testing-library/react";
import ClientsPage from "../src/pages/clients/ClientsPage.jsx";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders";

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));

let mockConnected = true;
jest.mock("../src/hooks/useWhatsApp.js", () => ({
  __esModule: true,
  default: () => ({ connected: mockConnected })
}));

jest.mock("../src/api/inboxApi.js");
const inboxApi = require("../src/api/inboxApi.js").default;

test("renderiza tabela com clientes", async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  renderWithRouterProviders(<ClientsPage />);
  expect(await screen.findByTestId("clients-table")).toBeInTheDocument();
});

test("botão Iniciar conversa WhatsApp aparece quando permitido", async () => {
  mockConnected = true;
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  renderWithRouterProviders(<ClientsPage />);
  expect(await screen.findByRole("button", { name: /Iniciar conversa WhatsApp/i })).toBeInTheDocument();
});

test("botão não aparece quando integração desconectada", async () => {
  mockConnected = false;
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  renderWithRouterProviders(<ClientsPage />);
  expect(screen.queryByRole("button", { name: /Iniciar conversa WhatsApp/i })).not.toBeInTheDocument();
});
