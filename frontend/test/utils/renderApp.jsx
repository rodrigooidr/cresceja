import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { OrgContext } from "../../src/contexts/OrgContext";
import { AuthContext } from "../../src/contexts/AuthContext";
import { TrialContext } from "../../src/contexts/TrialContext";

export function renderApp(ui, { route = "/", org, user } = {}) {
  const baseOrg = globalThis.__TEST_ORG__;
  const orgVal = {
    org: baseOrg,
    orgs: baseOrg ? [baseOrg] : [],
    selected: baseOrg ? baseOrg.id : null,
    loading: false,
    canSeeSelector: true,
    publicMode: false,
    setOrg: () => {},
    refreshOrg: async () => globalThis.__TEST_ORG__,
    // stubs usados em listas/filtros
    searchOrgs: async () => ({ items: [{ id: "org1", name: "Org 1" }], total: 1 }),
    searchClients: async () => ({ items: [], total: 0 }),
    paginate: async () => ({ items: [], total: 0, nextPage: null }),
    loadMoreOrgs: () => {},
    hasMore: false,
    q: "",
    ...(org || {}),
  };
  const authVal = {
    user: user || { id: "u_test", role: "OrgOwner", roles: ["SuperAdmin"] },
    token: "t",
    hasRole: () => true,
    login: async () => {},
    logout: async () => {},
  };
  const trialVal = {
    trialDays: 14,
    isTrial: true,
    endAt: new Date(Date.now() + 14 * 864e5),
  };

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={authVal}>
        <OrgContext.Provider value={orgVal}>
          <TrialContext.Provider value={trialVal}>{ui}</TrialContext.Provider>
        </OrgContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

