import React from 'react';

export default function AdminSplitPage({ sidebar, title, actions, children }) {
  return (
    <div className="flex h-full gap-4">
      <aside className="w-80 shrink-0">{sidebar}</aside>
      <main className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}
