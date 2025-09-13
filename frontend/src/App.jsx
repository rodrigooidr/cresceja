import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./ui/layout/AppLayout.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import ActiveOrgGate from "./hooks/ActiveOrgGate.jsx";
import RoleGate from "./auth/RoleGate.jsx";
import { CAN_VIEW_ORGANIZATIONS_ADMIN } from "./auth/roles";

// públicas
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";

// protegidas
import InboxPage from "./pages/inbox/InboxPage.jsx";
import ClientsPage from "./pages/clients/ClientsPage.jsx";
import AdminOrganizationsPage from "./pages/admin/organizations/AdminOrganizationsPage.jsx";
import OrgDetailsPage from "./pages/admin/OrgDetailsPage.jsx"; // ← detalhe da org
import PlansAdminPage from "./pages/admin/PlansAdminPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* rotas públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* rotas autenticadas */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {/* rotas que exigem org ativa selecionada */}
            <Route element={<ActiveOrgGate />}>
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/clients" element={<ClientsPage />} />
            </Route>

            {/* admin da plataforma (não depende da org ativa) */}
            <Route
              element={<RoleGate allow={CAN_VIEW_ORGANIZATIONS_ADMIN} redirectTo="/inbox" />}
            >
              <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
              <Route path="/admin/organizations/:id" element={<OrgDetailsPage />} />{/* ← add */}
              <Route path="/admin/plans" element={<PlansAdminPage />} />
            </Route>

            {/* (opcional) quando o usuário loga e não tem path, mande para o inbox */}
            <Route index element={<Navigate to="/inbox" replace />} />
          </Route>
        </Route>

        {/* fallback geral: qualquer rota desconhecida volta para a landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
