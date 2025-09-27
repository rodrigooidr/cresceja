import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils/renderApp.jsx";
import inboxApi, { listAdminOrgs, patchAdminOrgCredits } from "../src/api/inboxApi";
import AdminOrganizationsPage from "../src/pages/admin/organizations/AdminOrganizationsPage.jsx";

let user;

beforeEach(() => {
  user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  inboxApi.__resetRoutes?.();
  listAdminOrgs.mockClear?.();
  patchAdminOrgCredits.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("carrega organizações ativas por padrão", async () => {
  inboxApi.__mockRoute("GET", "/admin/orgs", () => ({
    data: [
      { id: "org-1", name: "Empresa A", status: "active" },
      { id: "org-2", name: "Empresa B", status: "inactive" },
    ],
  }));

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await waitFor(() => expect(listAdminOrgs).toHaveBeenCalled());
  expect(listAdminOrgs.mock.calls[0][0]).toBe("active");
  expect(await screen.findByText("Empresa A")).toBeInTheDocument();
});

test("altera filtro para status=all", async () => {
  inboxApi.__mockRoute("GET", "/admin/orgs", () => ({
    data: [
      { id: "org-1", name: "Empresa A", status: "active" },
      { id: "org-2", name: "Empresa B", status: "inactive" },
    ],
  }));

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  await waitFor(() => expect(listAdminOrgs).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole("button", { name: /todas/i }));

  await waitFor(() => expect(listAdminOrgs).toHaveBeenCalledTimes(2));
  expect(listAdminOrgs.mock.calls.at(-1)[0]).toBe("all");
});

test("modal executa patch, put e patch de créditos", async () => {
  inboxApi.__mockRoute("GET", "/admin/orgs", () => ({
    data: [
      {
        id: "org-1",
        name: "Empresa A",
        status: "active",
        plan_id: "starter",
        trial_ends_at: "2024-12-31",
      },
    ],
  }));
  inboxApi.__mockRoute("GET", "/public/plans", () => ({
    data: { items: [
      { id: "starter", name: "Starter" },
      { id: "pro", name: "Pro" },
    ] },
  }));
  let patchedOrgPayload = null;
  inboxApi.__mockRoute("PATCH", "/admin/orgs/org-1", ({ body }) => {
    patchedOrgPayload = body;
    return { data: { org: { id: "org-1", ...body } } };
  });
  let planPayload = null;
  inboxApi.__mockRoute("PUT", "/admin/orgs/org-1/plan", ({ body }) => {
    planPayload = body;
    return { data: { org: { id: "org-1", ...body } } };
  });
  let creditPayload = null;
  inboxApi.__mockRoute("PATCH", "/admin/orgs/org-1/credits", ({ body }) => {
    creditPayload = body;
    return { data: { ok: true } };
  });

  renderApp(<AdminOrganizationsPage />, {
    route: "/admin/organizations",
    user: { id: "admin", role: "SuperAdmin", roles: ["SuperAdmin"] },
  });

  const editButton = await screen.findByRole("button", { name: /editar/i });
  await user.click(editButton);

  const modalTitle = await screen.findByRole("heading", { name: /editar organização/i });
  expect(modalTitle).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Status$/i), { target: { value: "inactive" } });
  await user.click(screen.getByRole("button", { name: /salvar/i }));

  await waitFor(() => expect(patchedOrgPayload).not.toBeNull());
  expect(patchedOrgPayload).toEqual(expect.objectContaining({ status: "inactive" }));

  await user.click(screen.getByRole("button", { name: /registrar/i }));

  await waitFor(() => expect(planPayload).not.toBeNull());
  expect(planPayload).toEqual(expect.objectContaining({ plan_id: expect.any(String) }));

  const featureInput = screen.getByLabelText(/feature_code/i);
  await user.clear(featureInput);
  await user.type(featureInput, "sms");
  expect(featureInput).toHaveValue("sms");
  const deltaInput = screen.getByLabelText(/delta/i);
  await user.clear(deltaInput);
  await user.type(deltaInput, "10");
  expect(deltaInput).toHaveValue(10);
  await user.click(screen.getByRole("button", { name: /aplicar/i }));

  await waitFor(() => expect(patchAdminOrgCredits).toHaveBeenCalled());
  await waitFor(() => expect(creditPayload).not.toBeNull());
  expect(creditPayload).toEqual(
    expect.objectContaining({ feature_code: "sms", delta: 10, expires_at: null })
  );
});

