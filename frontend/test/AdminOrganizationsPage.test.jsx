import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOrganizationsPage from "../src/pages/admin/organizations/AdminOrganizationsPage.jsx";

jest.mock("../src/api/inboxApi.js", () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));

const inboxApi = require("../src/api/inboxApi.js").default;

test("renderiza tabela quando API retorna itens", async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: "1", company: { name: "ACME" }, owner: { name: "Joe", email: "joe@a.com" }, plan: { name: "Pro" }, subscription: { period: "2024" }, status: "Ativo" }] });
  render(<AdminOrganizationsPage />);
  expect(await screen.findByTestId("admin-orgs-table")).toBeInTheDocument();
});

test("filtros enviam params corretos", async () => {
  inboxApi.get.mockResolvedValue({ data: [] });
  render(<AdminOrganizationsPage />);
  fireEvent.change(screen.getByPlaceholderText("Empresa ou cliente"), { target: { value: "Foo" } });
  await waitFor(() => {
    expect(inboxApi.get).toHaveBeenLastCalledWith("/admin/orgs", { params: expect.objectContaining({ name: "Foo", email: "", phone: "", plan: "", status: "", periodFrom: "", periodTo: "" }) });
  });
});
