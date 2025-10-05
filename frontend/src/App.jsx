import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./ui/layout/AppLayout.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import ActiveOrgGate from "./hooks/ActiveOrgGate.jsx";
import RoleGate from "./auth/RoleGate.jsx";
import { canViewOrgPlan, canViewOrganizationsAdmin } from "./auth/roles";

// públicas
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";

// protegidas
import InboxPage from "./pages/inbox/InboxPage.jsx";
import ClientsPage from "./pages/clients/ClientsPage.jsx";
import CrmPage from "./pages/CrmPage.jsx";
import IntegrationsPage from "./pages/IntegrationsPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import FacebookPage from "./pages/FacebookPage.jsx";
import MarketingPage from "./pages/MarketingPage.jsx";
import InstagramPublisher from "./pages/marketing/InstagramPublisher.jsx";
import FacebookPublisher from "./pages/marketing/FacebookPublisher.jsx";
import ContentCalendar from "./pages/marketing/ContentCalendar.jsx";
import GovLogsPage from "./pages/marketing/GovLogsPage.jsx";
import TelemetryPage from "./pages/governanca/TelemetryPage.jsx";
import OrganizationsPage from "./pages/admin/OrganizationsPage.jsx";
import OrgDetailsPage from "./pages/admin/OrgDetailsPage.jsx"; // ← detalhe da org
import OrgBillingHistory from "./pages/admin/OrgBillingHistory.jsx";
import PlansAdminPage from "./pages/admin/PlansAdminPage.jsx";
import OrgPlanPage from "./pages/org/OrgPlanPage.jsx";

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
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/facebook" element={<FacebookPage />} />
              <Route path="/marketing/instagram" element={<InstagramPublisher />} />
              <Route path="/marketing/facebook" element={<FacebookPublisher />} />
              <Route path="/marketing/calendar" element={<ContentCalendar />} />
              <Route element={<RoleGate allow={canViewOrgPlan} redirectTo="/inbox" />}>
                <Route path="/settings/plan" element={<OrgPlanPage />} />
              </Route>
            </Route>

            {/* rotas que não dependem da org ativa */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/governanca" element={<GovLogsPage />} />
            <Route path="/settings/governanca/metricas" element={<TelemetryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/marketing" element={<MarketingPage />} />

            {/* admin da plataforma (não depende da org ativa) */}
            <Route
              element={<RoleGate allow={canViewOrganizationsAdmin} redirectTo="/inbox" />}
            >
              <Route path="/admin/organizations" element={<OrganizationsPage />} />
              <Route path="/admin/organizations/:id" element={<OrgDetailsPage />} />{/* ← add */}
              <Route
                path="/admin/organizations/:orgId/history"
                element={<OrgBillingHistory />}
              />
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
