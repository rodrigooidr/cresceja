import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "./utils/renderApp.jsx";
import inboxApi, { adminListOrgs } from "../src/api/inboxApi";
import AdminOrganizationsPage from "../src/pages/admin/organizations/AdminOrganizationsPage.jsx";

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  adminListOrgs.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("carrega organizações ativas por padrão", async () => {
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
    { id: "org-2", name: "Empresa B", slug: "empresa-b", status: "inactive" },
  ]);

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await waitFor(() => expect(adminListOrgs).toHaveBeenCalledWith({ status: "active" }));
  expect(await screen.findByText("Empresa A")).toBeInTheDocument();
  expect(screen.getByText("Empresa B")).toBeInTheDocument();
});
