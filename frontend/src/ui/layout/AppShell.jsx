// src/ui/layout/AppShell.jsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [expanded, setExpanded] = useState(false); // colapsado por padrão
  const sbWidth = expanded ? 220 : 64;

  return (
    <div className="min-h-screen">
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      {/* O main recebe padding-left igual à largura do sidebar */}
      <main
        style={{ paddingLeft: sbWidth }}
        className="transition-[padding] duration-200 h-screen overflow-hidden"
      >
        <Outlet />
      </main>
    </div>
  );
}
