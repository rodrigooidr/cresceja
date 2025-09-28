import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils/renderApp.jsx";
import { actTick } from "./utils/actUtils";
import inboxApi, {
  adminListOrgs,
  adminListPlans,
  patchAdminOrg,
  patchAdminOrgCredits,
  putAdminOrgPlan,
} from "../src/api/inboxApi";
import AdminOrganizationsPage from "../src/pages/admin/organizations/AdminOrganizationsPage.jsx";

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  adminListOrgs.mockClear?.();
  adminListPlans.mockClear?.();
  patchAdminOrg.mockClear?.();
  putAdminOrgPlan.mockClear?.();
  patchAdminOrgCredits.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
  adminListPlans.mockResolvedValue([
    { id: "plan-1", name: "Plano Starter" },
    { id: "plan-2", name: "Plano Pro" },
  ]);
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

test("edita dados básicos da organização", async () => {
  const user = userEvent.setup();
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
  ]);
  patchAdminOrg.mockResolvedValueOnce({ data: { org: { name: "Empresa Atualizada" } } });

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByText("Editar");
  await user.click(editButton);

  await actTick();
  await screen.findByTestId("admin-org-basic-form");
  const nameInput = screen.getByTestId("admin-org-basic-name");
  await user.clear(nameInput);
  await user.type(nameInput, "Nova Empresa");

  const saveButton = screen.getByTestId("admin-org-basic-save");
  await user.click(saveButton);

  await actTick();
  await waitFor(() =>
    expect(patchAdminOrg).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "Nova Empresa" })
    )
  );
  expect(await screen.findByText(/Dados atualizados com sucesso/i)).toBeInTheDocument();
});

test("registra novo plano manualmente", async () => {
  const user = userEvent.setup();
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active", plan_id: "plan-1" },
  ]);
  putAdminOrgPlan.mockResolvedValueOnce({ data: { ok: true } });

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByText("Editar");
  await user.click(editButton);

  await actTick();
  await screen.findByTestId("admin-org-plan-form");
  await user.selectOptions(screen.getByTestId("admin-org-plan-select"), "plan-2");
  const trialInput = screen.getByTestId("admin-org-plan-trial");
  fireEvent.change(trialInput, { target: { value: "2024-01-10" } });
  const metaInput = screen.getByTestId("admin-org-plan-meta");
  await user.clear(metaInput);
  await user.type(metaInput, '{"note":"manual"}');

  await user.click(screen.getByTestId("admin-org-plan-save"));

  await actTick();
  await waitFor(() =>
    expect(putAdminOrgPlan).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        plan_id: "plan-2",
        status: "active",
        trial_ends_at: expect.stringContaining("2024-01-10"),
        meta: { note: "manual" },
      })
    )
  );
  expect(await screen.findByText(/Plano atualizado com sucesso/i)).toBeInTheDocument();
});

test("aplica créditos extras", async () => {
  const user = userEvent.setup();
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
  ]);
  patchAdminOrgCredits.mockResolvedValueOnce({ data: { ok: true } });

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByText("Editar");
  await user.click(editButton);

  await actTick();
  await screen.findByTestId("admin-org-credits-form");
  fireEvent.change(screen.getByTestId("admin-org-credits-feature"), {
    target: { value: "ai_posts" },
  });
  fireEvent.change(screen.getByTestId("admin-org-credits-delta"), {
    target: { value: "5" },
  });
  await user.type(screen.getByTestId("admin-org-credits-meta"), '{"reason":"teste"}');

  await user.click(screen.getByTestId("admin-org-credits-save"));

  await actTick();
  await waitFor(() =>
    expect(patchAdminOrgCredits).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ feature_code: "ai_posts", delta: 5, meta: { reason: "teste" } })
    )
  );
  expect(await screen.findByText(/Créditos registrados/i)).toBeInTheDocument();
});
