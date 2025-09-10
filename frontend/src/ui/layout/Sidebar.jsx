// src/ui/layout/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, BarChart3, Settings, Bot, Calendar, FileText, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import inboxApi from '../../api/inboxApi';
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
  { to: '/admin/orgs', label: 'Organizações', icon: Users },
  { to: '/admin/planos', label: 'Planos', icon: BarChart3 },
];

export default function Sidebar({ expanded, setExpanded } = {}) {
  const [inner, setInner] = useState(false);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const isExpanded = typeof expanded === 'boolean' ? expanded : inner;
  const setExp = setExpanded || setInner;

  const width = isExpanded ? 220 : 64;
  const { logout, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await inboxApi.get('/auth/me');
        setMe(data);
      } catch (e) {
        console.error('auth_me_failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const role = me?.role || user?.role;
  const isAdmin = location.pathname.startsWith('/admin');
  let items = isAdmin ? ADMIN_NAV : NAV;
  if (!isAdmin && role === 'SuperAdmin') {
    items = [...items, { to: '/admin/orgs', label: 'Organizações/Clientes', icon: Users }, { to: '/admin/planos', label: 'Planos (Admin)', icon: BarChart3 }];
  }

  return (
    <aside
      onMouseEnter={() => setExp(true)}
      onMouseLeave={() => setExp(false)}
      className="fixed inset-y-0 left-0 border-r bg-white overflow-hidden transition-[width] duration-200 z-30 flex flex-col"
      style={{ width }}
      data-testid="sidebar"
    >
      {isExpanded && !isAdmin && (
        <div className="p-2 border-b">
          <OrgSwitcher />
        </div>
      )}
      <nav className="py-2 flex-1 overflow-y-auto">
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
