import React from 'react';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

export default function AppShell({ headerRight=null, children }) {
  return (
    <div className="h-screen w-full grid grid-rows-[56px_1fr]">
      <header className="bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="font-semibold">CresceJá</div>
        <div>{headerRight}</div>
      </header>

      <div className="grid grid-cols-[auto_1fr] overflow-hidden">
        <Sidebar />
        <section className="overflow-hidden">
          {children ?? <Outlet/>}
        </section>
      </div>
    </div>
  );
}
