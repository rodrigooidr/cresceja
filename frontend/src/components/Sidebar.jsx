// src/components/Sidebar.jsx
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import sidebar from '../config/sidebar';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const ROLE_ORDER = ['Viewer', 'Agent', 'Manager', 'OrgOwner', 'Support', 'SuperAdmin'];

const normalizeRole = (role) => {
  if (!role) return null;
  const k = String(role).trim().toLowerCase().replace(/[\s_-]/g, '');
  const map = {
    viewer: 'Viewer',
    agente: 'Agent',
    agent: 'Agent',
    manager: 'Manager',
    supervisor: 'Manager',
    owner: 'OrgOwner',
    orgowner: 'OrgOwner',
    orgadmin: 'OrgOwner',
    admin: 'OrgOwner',
    superadmin: 'SuperAdmin',
    superadministrator: 'SuperAdmin',
    support: 'Support',
  };
  return map[k] || null;
};

const hasRole = (userRole, minRole) => {
  const u = ROLE_ORDER.indexOf(normalizeRole(userRole));
  const m = ROLE_ORDER.indexOf(minRole);
  if (u === -1 || m === -1) return false;
  return u >= m;
};

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const hasFeature = (flag) => !flag || user?.features?.[flag];

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white border-r ${collapsed ? 'w-16' : 'w-52'} transition-all flex flex-col`}
    >
      <div className="p-2 flex items-center justify-between border-b">
        <button onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? '>' : '<'}
        </button>
      </div>
      {!isAdmin && (
        <div className="p-2">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
      )}
      <nav className="flex-1 overflow-y-auto mt-2">
        {sidebar.map((section) => {
          const items = section.items.filter((item) =>
            hasRole(user?.role, item.minRole) && hasFeature(item.feature)
          );
          if (!items.length) return null;
          return (
            <div key={section.section} className="mb-4">
              {!collapsed && (
                <div className="px-2 text-xs font-semibold text-gray-500 uppercase">
                  {section.section}
                </div>
              )}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-2 py-2 text-sm rounded ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed ? item.label[0] : item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <button
          type="button"
          onClick={logout}
          className="w-full text-left text-sm text-red-600 hover:underline"
        >
          {collapsed ? '⎋' : 'Sair'}
        </button>
      </div>
    </aside>
  );
}
