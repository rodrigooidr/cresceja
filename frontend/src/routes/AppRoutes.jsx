import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequirePerm from "@/components/RequirePerm.jsx";
import WhatsAppInbox from "@/pages/inbox/whatsapp/WhatsAppInbox.jsx";
import GovLogsPage from "@/pages/marketing/GovLogsPage.jsx";
import TelemetryPage from "@/pages/governanca/TelemetryPage.jsx";
import ContentCalendar from "@/pages/marketing/ContentCalendar.jsx";

const ROUTES = [
  {
    path: "/inbox",
    element: (
      <RequirePerm perm="inbox:view">
        <WhatsAppInbox />
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
        <TelemetryPage />
      </RequirePerm>
    ),
  },
  {
    path: "/marketing/calendar",
    element: (
      <RequirePerm perm="marketing:view">
        <ContentCalendar currentUser={{ role: "SuperAdmin" }} />
      </RequirePerm>
    ),
  },
  { path: "/", element: <Navigate to="/marketing/calendar" replace /> },
  { path: "*", element: <div>Not found</div> },
];

export const APP_ROUTES = ROUTES;

export default function AppRoutes() {
  return (
    <Routes>
      {ROUTES.map(({ path, element, index }) =>
        index ? (
          <Route key="index" index element={element} />
        ) : (
          <Route key={path ?? "__fallback__"} path={path} element={element} />
        )
      )}
    </Routes>
  );
}

AppRoutes.routes = ROUTES;
