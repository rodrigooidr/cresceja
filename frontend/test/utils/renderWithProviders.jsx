import React from "react";
import { render } from "@testing-library/react";

export const AuthContext = React.createContext({});
export const OrgContext = React.createContext({});

export function renderWithProviders(
  ui,
  {
    route = "/",
    user = { role: "SuperAdmin" },
    org = null,
  } = {}
) {
  window.history.pushState({}, "Test", route);

  return render(
    <AuthContext.Provider value={{ user, isAuthenticated: true }}>
      <OrgContext.Provider value={{ selected: org, setSelected: () => {} }}>
        {ui}
      </OrgContext.Provider>
    </AuthContext.Provider>
  );
}

