import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ContentCalendar from "../pages/marketing/ContentCalendar.jsx";
import GovLogsPage from "../pages/marketing/GovLogsPage.jsx";
import TelemetryPage from "../pages/governanca/TelemetryPage.jsx";
import WhatsAppInbox from "../pages/inbox/whatsapp/WhatsAppInbox.jsx";

export const APP_ROUTES = [
  { path: "/", element: <Navigate to="/marketing/calendar" replace /> },
  { path: "/inbox", element: <WhatsAppInbox /> },
  {
    path: "/marketing/calendar",
    element: <ContentCalendar currentUser={{ role: "SuperAdmin" }} />,
  },
  { path: "/settings/governanca", element: <GovLogsPage /> },
  { path: "/settings/governanca/metricas", element: <TelemetryPage /> },
  { path: "*", element: <div>Not found</div> },
];

export default function AppRoutes() {
  return (
    <Routes>
      {APP_ROUTES.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}

AppRoutes.routes = APP_ROUTES;
