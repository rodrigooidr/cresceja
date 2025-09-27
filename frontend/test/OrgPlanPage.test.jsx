import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "./utils/renderApp.jsx";
import inboxApi, { getOrgPlanSummary } from "../src/api/inboxApi";
import OrgPlanPage from "../src/pages/org/OrgPlanPage.jsx";

beforeEach(() => {
  inboxApi.__resetRoutes?.();
  getOrgPlanSummary.mockClear?.();
  localStorage.clear();
  localStorage.setItem("token", "test-token");
});

test("exibe resumo do plano e créditos", async () => {
  inboxApi.__mockRoute("GET", "/orgs/org-1/plan/summary", () => ({
    data: {
      org: {
        id: "org-1",
        name: "Org One",
        slug: "org-one",
        status: "active",
        plan_id: "pro",
        trial_ends_at: "2024-05-20T00:00:00.000Z",
      },
      credits: [
        {
          feature_code: "sms",
          remaining_total: 120,
          expires_next: "2024-06-01T00:00:00.000Z",
        },
      ],
    },
  }));
  inboxApi.__mockRoute("GET", "/public/plans", () => ({
    data: { items: [{ id: "pro", name: "Pro" }] },
  }));

  renderApp(<OrgPlanPage />, {
    route: "/settings/plan",
    org: {
      selected: "org-1",
      orgs: [{ id: "org-1", name: "Org One" }],
      publicMode: false,
    },
    user: { id: "user", role: "OrgAdmin", roles: [] },
  });

  await waitFor(() => expect(getOrgPlanSummary).toHaveBeenCalled());
  expect(getOrgPlanSummary.mock.calls[0][0]).toBe("org-1");

  expect(await screen.findByText("Pro")).toBeInTheDocument();
  expect(screen.getByText(/Org One/)).toBeInTheDocument();
  expect(screen.getByText(/sms/i)).toBeInTheDocument();
  expect(screen.getByText("120")).toBeInTheDocument();
  expect(screen.getByText(/20\/05\/2024/)).toBeInTheDocument();
});

test("mostra mensagem quando não há créditos", async () => {
  inboxApi.__mockRoute("GET", "/orgs/org-1/plan/summary", () => ({
    data: {
      org: {
        id: "org-1",
        name: "Org Sem Créditos",
        slug: "org-sem",
        status: "active",
        plan_id: "starter",
        trial_ends_at: null,
      },
      credits: [],
    },
  }));
  inboxApi.__mockRoute("GET", "/public/plans", () => ({
    data: { items: [{ id: "starter", name: "Starter" }] },
  }));

  renderApp(<OrgPlanPage />, {
    route: "/settings/plan",
    org: {
      selected: "org-1",
      orgs: [{ id: "org-1", name: "Org Sem Créditos" }],
      publicMode: false,
    },
    user: { id: "user", role: "OrgOwner", roles: [] },
  });

  await waitFor(() => expect(getOrgPlanSummary).toHaveBeenCalled());

  expect(await screen.findByText(/Sem créditos\./i)).toBeInTheDocument();
});

