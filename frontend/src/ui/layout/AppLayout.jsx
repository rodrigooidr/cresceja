import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

export default function AppLayout() {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <Sidebar />
      </aside>
      <main className="bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
