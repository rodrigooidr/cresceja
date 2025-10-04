import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "./utils/renderApp.jsx";
import WorkspaceSwitcher from "../src/components/WorkspaceSwitcher.jsx";
import inboxApi, { adminListOrgs } from "../src/api/inboxApi";

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  adminListOrgs.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("super admin carrega organizações ativas pelo endpoint global", async () => {
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Org One", slug: "org-one" },
    { id: "org-2", name: "Org Two", slug: "org-two" },
  ]);

  renderApp(<WorkspaceSwitcher />, {
    user: { id: "sa", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await waitFor(() => expect(adminListOrgs).toHaveBeenCalledWith({ status: "active" }));
  expect(await screen.findByRole("option", { name: "Org One" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Org Two" })).toBeInTheDocument();
});
