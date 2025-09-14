import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { OrgContext } from "../../src/contexts/OrgContext";

export function renderWithProviders(ui, { route = "/", org, ...options } = {}) {
  const value = {
    org: org || globalThis.__TEST_ORG__,
    setOrg: () => {},
    refreshOrg: async () => globalThis.__TEST_ORG__,
  };

  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Mantido por retrocompatibilidade; FeatureGate já é mockado em setupTests
export function mockFeatureGate() {}
