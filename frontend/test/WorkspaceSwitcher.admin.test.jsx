import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "./utils/renderApp.jsx";
import WorkspaceSwitcher from "../src/components/WorkspaceSwitcher.jsx";
import inboxApi, { listAdminOrgs } from "../src/api/inboxApi";

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  listAdminOrgs.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("super admin carrega organizações ativas pelo endpoint global", async () => {
  inboxApi.__mockRoute("GET", "/admin/orgs", () => ({
    data: [
      { id: "org-1", name: "Org One", slug: "org-one" },
      { id: "org-2", name: "Org Two", slug: "org-two" },
    ],
  }));

  renderApp(<WorkspaceSwitcher />, {
    user: { id: "sa", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await waitFor(() => expect(listAdminOrgs).toHaveBeenCalled());
  expect(listAdminOrgs.mock.calls[0][0]).toBe("active");
  expect(await screen.findByRole("option", { name: "Org One" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Org Two" })).toBeInTheDocument();
});

