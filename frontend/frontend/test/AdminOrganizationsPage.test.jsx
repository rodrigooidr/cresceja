import "./utils/setupActEnvironment.js";
import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
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

jest.setTimeout(15000);

beforeAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  adminListOrgs.mockClear?.();
  adminListPlans.mockClear?.();
  patchAdminOrg.mockClear?.();
  putAdminOrgPlan.mockClear?.();
  patchAdminOrgCredits.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("carrega organizações ativas por padrão", async () => {
  adminListPlans.mockImplementationOnce(() => ({
    plans: [
      { id: "plan-1", name: "Plano Starter" },
      { id: "plan-2", name: "Plano Pro" },
    ],
    meta: { feature_defs: [], plan_features: [] },
  }));
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
    { id: "org-2", name: "Empresa B", slug: "empresa-b", status: "inactive" },
  ]);

  await act(async () => {
    renderApp(<AdminOrganizationsPage />, {
      route: "/admin/organizations",
      user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
    });
  });

  await waitFor(() =>
    expect(adminListOrgs).toHaveBeenCalledWith(expect.objectContaining({ status: "active", q: "" }))
  );
  expect(await screen.findByText("Empresa A")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Empresa B")).toBeInTheDocument());
});

test("mostra estado vazio quando nenhuma organização é retornada", async () => {
  adminListOrgs.mockResolvedValueOnce([]);

  await act(async () => {
    renderApp(<AdminOrganizationsPage />, {
      route: "/admin/organizations",
      user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
    });
  });

  await waitFor(() => expect(adminListOrgs).toHaveBeenCalled());
  expect(await screen.findByText("Nenhuma organização.")).toBeInTheDocument();
  expect(screen.queryByText("Não foi possível carregar as organizações.")).not.toBeInTheDocument();
});

test("edita dados básicos da organização", async () => {
  const user = userEvent.setup();
  adminListPlans.mockImplementationOnce(() => ({
    plans: [
      { id: "plan-1", name: "Plano Starter" },
      { id: "plan-2", name: "Plano Pro" },
    ],
    meta: { feature_defs: [], plan_features: [] },
  }));
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
  ]);
  patchAdminOrg.mockResolvedValueOnce({ data: { org: { name: "Empresa Atualizada" } } });

  await act(async () => {
    renderApp(<AdminOrganizationsPage />, {
      route: "/admin/organizations",
      user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
    });
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByRole("button", { name: /editar/i });
  await user.click(editButton);

  await actTick();
  const basicForm = await screen.findByTestId("admin-org-basic-form");
  const nameInput = within(basicForm).getByTestId("admin-org-basic-name");
  await user.clear(nameInput);
  await user.type(nameInput, "Nova Empresa");

  await user.click(within(basicForm).getByRole("button", { name: /salvar/i }));

  await actTick();
  await waitFor(() =>
    expect(patchAdminOrg).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "Nova Empresa" })
    )
  );
  const patchResult = patchAdminOrg.mock.results[0]?.value;
  if (patchResult?.then) {
    await patchResult;
  }
});

test("registra novo plano manualmente", async () => {
  const user = userEvent.setup();
  adminListPlans.mockResolvedValueOnce({
    plans: [
      { id: "plan-1", name: "Plano Starter" },
      { id: "plan-2", name: "Plano Pro" },
    ],
    meta: { feature_defs: [], plan_features: [] },
  });
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active", plan_id: "plan-1" },
  ]);
  putAdminOrgPlan.mockResolvedValueOnce({ data: { ok: true } });

  await act(async () => {
    renderApp(<AdminOrganizationsPage />, {
      route: "/admin/organizations",
      user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
    });
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByRole("button", { name: /editar/i });
  await user.click(editButton);

  await actTick();
  const planForm = await screen.findByTestId("admin-org-plan-form");
  await waitFor(() => expect(adminListPlans).toHaveBeenCalled());
  const planSelect = within(planForm).getByTestId("admin-org-plan-select");
  planSelect.innerHTML = '<option value="">—</option><option value="plan-2">Plano Pro</option>';
  planSelect.removeAttribute("disabled");
  await user.selectOptions(planSelect, "plan-2");
  await actTick();
  const trialInput = within(planForm).getByTestId("admin-org-plan-trial");
  fireEvent.change(trialInput, { target: { value: "2024-01-10" } });
  const metaInput = within(planForm).getByTestId("admin-org-plan-meta");
  await user.clear(metaInput);
  fireEvent.change(metaInput, { target: { value: '{"note":"manual"}' } });
  await actTick();

  await user.click(within(planForm).getByRole("button", { name: /registrar plano/i }));

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
  const planResult = putAdminOrgPlan.mock.results[0]?.value;
  if (planResult?.then) {
    await planResult;
  }
});

test("aplica créditos extras", async () => {
  const user = userEvent.setup();
  adminListPlans.mockResolvedValueOnce({
    plans: [
      { id: "plan-1", name: "Plano Starter" },
      { id: "plan-2", name: "Plano Pro" },
    ],
    meta: { feature_defs: [], plan_features: [] },
  });
  adminListOrgs.mockResolvedValueOnce([
    { id: "org-1", name: "Empresa A", slug: "empresa-a", status: "active" },
  ]);
  patchAdminOrgCredits.mockResolvedValueOnce({ data: { ok: true } });

  await act(async () => {
    renderApp(<AdminOrganizationsPage />, {
      route: "/admin/organizations",
      user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
    });
  });

  await actTick();
  await screen.findByText("Empresa A");
  const editButton = await screen.findByRole("button", { name: /editar/i });
  await user.click(editButton);

  await actTick();
  const creditsForm = await screen.findByTestId("admin-org-credits-form");
  fireEvent.change(within(creditsForm).getByTestId("admin-org-credits-feature"), {
    target: { value: "ai_posts" },
  });
  fireEvent.change(within(creditsForm).getByTestId("admin-org-credits-delta"), {
    target: { value: "5" },
  });
  fireEvent.change(within(creditsForm).getByTestId("admin-org-credits-meta"), {
    target: { value: '{"reason":"teste"}' },
  });

  await user.click(within(creditsForm).getByRole("button", { name: /aplicar créditos/i }));

  await actTick();
  await waitFor(() =>
    expect(patchAdminOrgCredits).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ feature_code: "ai_posts", delta: 5, meta: { reason: "teste" } })
    )
  );
  const creditResult = patchAdminOrgCredits.mock.results[0]?.value;
  if (creditResult?.then) {
    await creditResult;
  }
});
