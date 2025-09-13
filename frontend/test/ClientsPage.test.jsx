import React from "react";
import { render, screen } from "@testing-library/react";
import ClientsPage from "../src/pages/clients/ClientsPage.jsx";

jest.mock("../src/auth/useAuth.js", () => ({
  useAuth: () => ({ user: { role: "Admin" } })
}));

let mockSelected = "org1";
jest.mock("../src/contexts/OrgContext.jsx", () => ({
  useOrg: () => ({ selected: mockSelected }),
  OrgProvider: ({ children }) => <>{children}</>,
}));

let mockConnected = true;
jest.mock("../src/hooks/useWhatsApp.js", () => ({
  __esModule: true,
  default: () => ({ connected: mockConnected })
}));

jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() }
}));
const inboxApi = require("../src/api/inboxApi.js").default;

test("renderiza tabela com clientes", async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  render(<ClientsPage />);
  expect(await screen.findByTestId("clients-table")).toBeInTheDocument();
});

test("botão Iniciar conversa WhatsApp aparece quando permitido", async () => {
  mockConnected = true;
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  render(<ClientsPage />);
  expect(await screen.findByRole("button", { name: /Iniciar conversa WhatsApp/i })).toBeInTheDocument();
});

test("botão não aparece quando integração desconectada", async () => {
  mockConnected = false;
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", name: "Ana", phone: "123", email: "a@b.com", tags: [], crmStage: "Lead", activeWhatsappConversation: false }] });
  render(<ClientsPage />);
  expect(screen.queryByRole("button", { name: /Iniciar conversa WhatsApp/i })).not.toBeInTheDocument();
});
