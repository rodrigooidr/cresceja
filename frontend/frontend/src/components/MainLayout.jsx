// src/components/MainLayout.jsx
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TrialTopBanner from "./TrialTopBanner";

export default function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Compensa a largura do sidebar fixo (16 = 4rem, 52 = 13rem)
  const padClass = collapsed ? "md:pl-16" : "md:pl-52";

  return (
    <div className={`min-h-screen bg-gray-50 ${padClass}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main role="main" className="p-4 sm:p-6">
        <div className="mb-4">
          <TrialTopBanner />
        </div>
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
