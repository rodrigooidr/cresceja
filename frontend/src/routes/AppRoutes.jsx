import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ContentCalendar from "../pages/marketing/ContentCalendar.jsx";
import GovLogsPage from "../pages/marketing/GovLogsPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/marketing/calendar" replace />} />
      <Route path="/marketing/calendar" element={<ContentCalendar currentUser={{ role: "SuperAdmin" }} />} />
      <Route path="/settings/governanca" element={<GovLogsPage />} />
      <Route path="*" element={<div>Not found</div>} />
    </Routes>
  );
}
