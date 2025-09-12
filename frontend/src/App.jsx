import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./ui/layout/AppLayout.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import ActiveOrgGate from "./hooks/ActiveOrgGate.jsx";
import RoleGate from "./auth/RoleGate.jsx";
import { CAN_VIEW_ORGANIZATIONS_ADMIN } from "./auth/roles";

import InboxPage from "./pages/inbox/InboxPage.jsx";
import AdminOrganizationsPage from "./pages/admin/organizations/AdminOrganizationsPage.jsx";
import ClientsPage from "./pages/clients/ClientsPage.jsx";
import PlansAdminPage from "./pages/admin/PlansAdminPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* públicas (landing, login, etc.) */}

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {/* Rotas dependentes da org ativa */}
            <Route element={<ActiveOrgGate />}>
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/clients" element={<ClientsPage />} />
            </Route>

            {/* Organizações: admin da plataforma (sem exigir org ativa) */}
            <Route
              element={<RoleGate allow={CAN_VIEW_ORGANIZATIONS_ADMIN} redirectTo="/inbox" />}
            >
              <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
              <Route path="/admin/plans" element={<PlansAdminPage />} />
            </Route>

            <Route index element={<Navigate to="/inbox" replace />} />
            <Route path="*" element={<Navigate to="/inbox" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
