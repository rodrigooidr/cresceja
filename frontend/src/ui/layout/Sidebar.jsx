// src/ui/layout/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, BarChart3, Settings, Bot, Calendar, FileText, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import OrgSwitcher from '../../components/nav/OrgSwitcher.jsx';

const NAV = [
  { to: '/app/inbox',               label: 'Inbox',         icon: MessageSquare },
  { to: '/app/marketing',           label: 'Marketing',     icon: Zap },
  { to: '/app/marketing/lists',     label: 'Listas',        icon: Users },
  { to: '/app/marketing/templates', label: 'Templates',    icon: FileText },
  { to: '/app/calendars',           label: 'Calendários',   icon: Calendar },
  { to: '/app/settings/channels',   label: 'Configurações', icon: Settings },
  { to: '/app/ai',                  label: 'IA',            icon: Bot },
];

const ADMIN_NAV = [
  { to: '/admin/organizations', label: 'Organizações/Clientes', icon: Users },
  { to: '/admin/plans', label: 'Planos (Admin)', icon: BarChart3 },
];

export default function Sidebar({ expanded, setExpanded } = {}) {
  const [inner, setInner] = useState(false);
  const isExpanded = typeof expanded === 'boolean' ? expanded : inner;
  const setExp = setExpanded || setInner;

  const width = isExpanded ? 220 : 64;
  const { logout, user } = useAuth?.() ?? { logout: () => {}, user: null };
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isAdminRole = ['SuperAdmin', 'Admin', 'Owner'].includes(user?.role);

  const items = isAdminPath
    ? ADMIN_NAV
    : isAdminRole
    ? [...NAV, ...ADMIN_NAV]
    : NAV;

  return (
    <aside
      onMouseEnter={() => setExp(true)}
      onMouseLeave={() => setExp(false)}
      className="fixed inset-y-0 left-0 border-r bg-white overflow-hidden transition-[width] duration-200 z-30 flex flex-col"
      style={{ width }}
    >
      {isExpanded && !isAdminPath && (
        <div className="p-2 border-b">
          <OrgSwitcher />
        </div>
      )}
      <nav data-testid="sidebar" className="py-2 flex-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50
               ${isActive ? 'text-blue-600 font-medium' : 'text-gray-700'}`
            }
            title={label}
            aria-label={label}
          >
            <Icon size={20} className="shrink-0" />
            {isExpanded && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Botão Sair */}
      <div className="border-t p-2">
        <button
          type="button"
          onClick={logout}
          className="w-full text-left text-sm text-red-600 hover:underline"
        >
          {isExpanded ? 'Sair' : '⎋'}
        </button>
      </div>
    </aside>
  );
}
