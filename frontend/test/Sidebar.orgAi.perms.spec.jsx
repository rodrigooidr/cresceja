import React from "react";
import { render, screen } from "@testing-library/react";
import Sidebar from "@/ui/layout/Sidebar.jsx";
import { AuthContext } from "@/contexts/AuthContext.jsx";
import { OrgContext } from "@/contexts/OrgContext.jsx";

const baseOrgContext = {
  orgs: [],
  loading: false,
  selected: null,
  setSelected: () => {},
  canSeeSelector: false,
  publicMode: true,
  searchOrgs: () => {},
  loadMoreOrgs: () => {},
  hasMore: false,
  q: "",
};

function renderSidebar(role, overrides = {}) {
  const orgValue = { ...baseOrgContext, ...overrides };
  return render(
    <AuthContext.Provider value={{ user: role ? { id: "user", role } : null }}>
      <OrgContext.Provider value={orgValue}>
        <Sidebar />
      </OrgContext.Provider>
    </AuthContext.Provider>
  );
}

describe("Sidebar IA da Organização", () => {
  it("mantém item desabilitado para papéis sem permissão", () => {
    renderSidebar("Agent");
    const item = screen.getByTestId("nav-settings-ai");
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("habilita item para OrgAdmin", () => {
    renderSidebar("OrgAdmin");
    const item = screen.getByTestId("nav-settings-ai");
    expect(item).not.toHaveAttribute("aria-disabled");
    expect(item.getAttribute("href")).toBe("/settings/ai");
  });
});
