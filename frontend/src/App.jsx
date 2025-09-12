import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./ui/layout/AppLayout.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import ActiveOrgGate from "./hooks/ActiveOrgGate.jsx";

import InboxPage from "./pages/inbox/InboxPage.jsx";
import OrganizationsPage from "./pages/admin/OrganizationsPage.jsx";
import PlansAdminPage from "./pages/admin/PlansAdminPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route element={<ActiveOrgGate />}>
              <Route path="/inbox" element={<InboxPage />} />
            </Route>
            <Route path="/admin/organizations" element={<OrganizationsPage />} />
            <Route path="/admin/plans" element={<PlansAdminPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
