import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppLayout from "../src/ui/layout/AppLayout.jsx";
import OrganizationsPage from "../src/pages/admin/OrganizationsPage.jsx";
import PlansAdminPage from "../src/pages/admin/PlansAdminPage.jsx";

jest.mock("../src/ui/layout/Sidebar.jsx", () => () => <div data-testid="sidebar" />);

describe("admin routes render sidebar", () => {
  test("/admin/organizations", () => {
    render(
      <MemoryRouter initialEntries={["/admin/organizations"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/admin/organizations" element={<OrganizationsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  test("/admin/plans", () => {
    render(
      <MemoryRouter initialEntries={["/admin/plans"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/admin/plans" element={<PlansAdminPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
