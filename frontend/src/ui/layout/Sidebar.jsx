import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  MessageSquare, Users, BarChart3, Settings, Bot, Calendar, FileText, Zap
} from 'lucide-react';

const NAV = [
  { to: '/app/inbox',        label: 'Inbox',         icon: MessageSquare },
  { to: '/app/crm',          label: 'CRM',           icon: Users },
  { to: '/app/calendars',    label: 'Calendários',   icon: Calendar },
  { to: '/app/reports',      label: 'Relatórios',    icon: BarChart3 },
  { to: '/app/templates',    label: 'Snippets',      icon: FileText },
  { to: '/app/automations',  label: 'Automations',   icon: Zap },
  { to: '/app/settings',     label: 'Configurações', icon: Settings },
  { to: '/app/ai',           label: 'IA',            icon: Bot },
];

export default function Sidebar(){
  const [expanded, setExpanded] = useState(false); // colapsado por padrão
  const w = expanded ? 220 : 64;

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="border-r bg-white overflow-hidden transition-[width] duration-200"
      style={{ width: w }}
      data-testid="sidebar"
    >
      <nav className="py-2">
        {NAV.map(({to,label,icon:Icon}) => (
          <NavLink
            key={to}
            to={to}
            className={({isActive}) =>
              `flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50
               ${isActive ? 'text-blue-600 font-medium' : 'text-gray-700'}`
            }
            title={label}
            aria-label={label}
          >
            <Icon size={20} className="shrink-0" />
            {expanded && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
