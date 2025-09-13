// frontend/src/ui/layout/AppLayout.jsx
import React from "react"; // se seu projeto ainda exige React em escopo
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { OrgProvider } from "../../contexts/OrgContext.jsx";

export default function AppLayout() {
  return (
    <OrgProvider>
      <div className="flex h-screen">
        <aside className="w-72 border-r">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </OrgProvider>
  );
}
