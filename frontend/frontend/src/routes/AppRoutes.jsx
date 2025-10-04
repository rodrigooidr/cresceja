import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ContentCalendar from "../pages/marketing/ContentCalendar.jsx";
import GovLogsPage from "../pages/marketing/GovLogsPage.jsx";
import TelemetryPage from "../pages/governanca/TelemetryPage.jsx";
import WhatsAppInbox from "../pages/inbox/whatsapp/WhatsAppInbox.jsx";
import RequirePerm from "@/components/RequirePerm.jsx";
import CalendarSettingsPage from "@/pages/settings/CalendarSettingsPage.jsx";
import RequireRole from "./guards/RequireRole.jsx";
import OrgAIPage from "@/pages/settings/OrgAIPage.jsx";

// ÚNICA fonte de verdade para as rotas
export const APP_ROUTES = [
  { path: "/", element: <Navigate to="/marketing/calendar" replace /> },

  {
    path: "/inbox",
    element: (
      <RequirePerm perm="inbox:view">
        <WhatsAppInbox />
      </RequirePerm>
    ),
  },

  {
    path: "/marketing/calendar",
    element: (
      <RequirePerm perm="marketing:view">
        <ContentCalendar currentUser={{ role: "OrgOwner", roles: ["SuperAdmin"] }} />
      </RequirePerm>
    ),
  },

  {
    path: "/settings/governanca",
    element: (
      <RequirePerm perm="audit:view">
        <GovLogsPage />
      </RequirePerm>
    ),
  },

  {
    path: "/settings/governanca/metricas",
    element: (
      <RequirePerm perm="telemetry:view">
        {/* Se padronizou no backend para analytics.view,
            troque a perm acima para 'analytics:view' */}
        <TelemetryPage />
      </RequirePerm>
    ),
  },

  {
    path: "/settings/agenda",
    element: (
      <RequirePerm perm="settings:agenda">
        <CalendarSettingsPage />
      </RequirePerm>
    ),
  },

  {
    path: "/settings/ai",
    element: (
      <RequireRole orgRoles={["OrgAdmin", "OrgOwner"]} globalRoles={["SuperAdmin"]}>
        <OrgAIPage />
      </RequireRole>
    ),
  },

  { path: "*", element: <div>Not found</div> },
];

export default function AppRoutes() {
  return (
    <Routes>
      {APP_ROUTES.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
    </Routes>
  );
}

// opcional: expor a lista de rotas para testes/outros usos
AppRoutes.routes = APP_ROUTES;
