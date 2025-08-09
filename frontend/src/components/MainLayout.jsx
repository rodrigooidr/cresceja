import React from 'react';
import Sidebar from '../components/Sidebar';

function MainLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-48 p-6 w-full bg-gray-50 min-h-screen">{children}</main>
    </div>
  );
}

export default MainLayout;