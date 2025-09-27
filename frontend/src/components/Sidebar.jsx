// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import sidebar from '../config/sidebar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import inboxApi from '../api/inboxApi';
import { hasPerm } from '@/auth/permCompat';
import { hasGlobalRole, hasOrgRole } from '@/auth/roles';

const ORG_ADMIN_ROLES = ['OrgAdmin', 'OrgOwner'];
const ORG_AGENT_ROLES = ['OrgAgent', 'OrgAdmin', 'OrgOwner'];

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const hasFeature = (flag) => !flag || user?.features?.[flag];
  const [me, setMe] = useState(null);

  const authSource = useMemo(() => {
    if (me) return me;
    if (user) return user;
    return null;
  }, [me, user]);

  const contractLinks = [
    { perm: 'inbox:view', to: '/inbox', label: 'Inbox', orgRoles: ORG_AGENT_ROLES },
    { perm: 'audit:view', to: '/settings/governanca', label: 'Governança & Logs', orgRoles: ORG_ADMIN_ROLES },
    { perm: 'telemetry:view', to: '/settings/governanca/metricas', label: 'Métricas', orgRoles: ORG_ADMIN_ROLES },
    { perm: 'marketing:view', to: '/marketing/calendar', label: 'Calendário', orgRoles: ORG_AGENT_ROLES },
    { perm: 'settings:agenda', to: '/settings/agenda', label: 'Agenda & Serviços', orgRoles: ORG_ADMIN_ROLES },
  ];

  const visibleContractLinks = contractLinks.filter(({ perm, orgRoles }) => {
    if (!authSource) return false;
    if (orgRoles && !hasOrgRole(orgRoles, authSource)) return false;
    return hasPerm(perm, authSource);
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await inboxApi.get('/auth/me');
        if (!cancelled) setMe(data);
      } catch (e) {
        console.error('auth_me_failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showAdmin = authSource ? hasGlobalRole(['SuperAdmin', 'Support'], authSource) : false;

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white border-r ${collapsed ? 'w-16' : 'w-52'} transition-all flex flex-col`}
    >
      <div className="p-2 flex items-center justify-between border-b">
        <button onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? '>' : '<'}
        </button>
      </div>
      {!isAdminRoute && (
        <div className="p-2">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
      )}
      <nav className="flex-1 overflow-y-auto mt-2">
        {visibleContractLinks.length > 0 && (
          <div className="mb-4">
            {!collapsed && (
              <div className="px-2 text-xs font-semibold text-gray-500 uppercase">
                Navegação
              </div>
            )}
            {visibleContractLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `block px-2 py-2 text-sm rounded ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
                title={collapsed ? label.charAt(0) : undefined}
              >
                {collapsed ? label.charAt(0) : label}
              </NavLink>
            ))}
          </div>
        )}
        {sidebar.map((section) => {
          const items = section.items.filter((item) => {
            if (!authSource) return false;
            if (item.orgRoles && !hasOrgRole(item.orgRoles, authSource)) return false;
            if (item.globalRoles && !hasGlobalRole(item.globalRoles, authSource)) return false;
            if (!hasFeature(item.feature)) return false;
            if (item.perm && !hasPerm(item.perm, authSource)) return false;
            return true;
          });
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
        {showAdmin && (
          <NavLink
            to="/admin/organizations"
            className={({ isActive }) =>
              `block px-2 py-2 text-sm rounded ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
            title={collapsed ? 'Empresas' : undefined}
          >
            {collapsed ? 'E' : 'Empresas'}
          </NavLink>
        )}
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
