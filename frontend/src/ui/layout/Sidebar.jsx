// frontend/src/ui/layout/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  MessageSquare,
  Users,
  Briefcase,
  Plug,
  BarChart3,
  Settings as SettingsIcon,
  Brain,
  Calendar,
  Megaphone,
  Instagram,
  Facebook,
  Building2,
  CreditCard,
  LogOut,
} from "lucide-react";
import { useOrg } from "../../contexts/OrgContext.jsx";
import { useAuth } from "../../contexts/AuthContext";
import {
  canEditClients,
  canViewOrganizationsAdmin,
  hasGlobalRole,
  hasOrgRole,
} from "../../auth/roles";
import { canUse, limitKeyFor } from "../../utils/featureGate.js";
import OrgSelect from "../../components/OrgSelect.jsx";

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  disabled,
  title,
  testId,
}) {
  const content = (
    <>
      {Icon ? <Icon size={18} className="shrink-0" aria-hidden="true" /> : null}
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  if (disabled) {
    return (
      <div
        className={`flex items-center rounded px-3 py-2 text-sm opacity-60 cursor-not-allowed ${
          collapsed ? "justify-center" : "gap-2"
        }`}
        title={title || label}
        data-testid={testId}
        aria-disabled="true"
      >
        {Icon ? <Icon size={18} className="shrink-0" aria-hidden="true" /> : null}
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      title={title || label}
      data-testid={testId}
      aria-label={label}
      className={({ isActive }) => {
        const base = "flex items-center rounded px-3 py-2 text-sm transition-colors";
        const align = collapsed ? "justify-center" : "gap-2";
        const active = isActive
          ? "bg-gray-100 font-medium text-gray-900"
          : "text-gray-700 hover:bg-gray-100";
        return `${base} ${align} ${active}`;
      }}
    >
      {content}
    </NavLink>
  );
}

function OrgPicker({ collapsed }) {
  const { orgs, selected, canSeeSelector, publicMode } = useOrg();
  const active = orgs.find((org) => String(org.id) === String(selected));

  if (publicMode || !canSeeSelector) {
    return (
      <div className="p-3 border-b space-y-2">
        <div className="text-xs text-gray-500">Organização</div>
        <div className="px-3 py-2 rounded bg-gray-50">
          {publicMode ? 'Modo público' : 'Acesso restrito'}
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="p-3 border-b flex items-center justify-center text-xs font-semibold uppercase">
        <span title={active?.name || 'Selecionar organização'}>
          {(active?.name || active?.slug || 'Org').slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 border-b">
      <OrgSelect />
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { selected, publicMode, org } = useOrg();
  const needsOrg = !publicMode && !selected;
  const canManageOrgAI = hasOrgRole(["OrgAdmin", "OrgOwner"], user) || hasGlobalRole(["SuperAdmin"], user);
  const isSuperAdmin = hasGlobalRole(["SuperAdmin"], user);

  const [hovered, setHovered] = useState(false);
  const collapsed = !hovered;

  useEffect(() => {
    const onResize = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 1024) {
        setHovered(false);
      }
    };
    if (typeof window !== 'undefined') {
      const id = requestAnimationFrame(onResize);
      window.addEventListener('resize', onResize);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener('resize', onResize);
      };
    }
    return () => {};
  }, []);

  return (
    <aside
      className={`group/sidebar h-full flex flex-col border-r bg-white transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-16' : 'w-72'
      }`}
      data-testid="sidebar"
      aria-label="sidebar"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <OrgPicker collapsed={collapsed} />

      <div className="p-3 space-y-1 flex-1 overflow-auto" id="sidebar-panel">
        <NavItem
          to="/inbox"
          icon={MessageSquare}
          label="Inbox"
          disabled={needsOrg}
          title="Selecione uma organização para abrir o Inbox"
          collapsed={collapsed}
        />
        {canEditClients(user) && (
          <NavItem
            to="/clients"
            icon={Users}
            label="Clientes"
            disabled={needsOrg}
            title="Selecione uma organização para ver Clientes"
            collapsed={collapsed}
          />
        )}
        <NavItem
          to="/crm"
          icon={Briefcase}
          label="CRM"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/integrations"
          icon={Plug}
          label="Integrações"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/reports"
          icon={BarChart3}
          label="Relatórios"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/settings"
          icon={SettingsIcon}
          label="Configurações"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        {(() => {
          const aiDisabled = needsOrg || !canManageOrgAI;
          const aiTitle = !canManageOrgAI
            ? 'Disponível apenas para Org Admins ou Super Admins'
            : 'Selecione uma organização para acessar a IA';
          return (
            <NavItem
              to="/settings/ai"
              icon={Brain}
              label="IA da Organização"
              disabled={aiDisabled}
              collapsed={collapsed}
              title={aiTitle}
              testId="nav-settings-ai"
            />
          );
        })()}
        <NavItem
          to="/calendar"
          icon={Calendar}
          label="Calendário"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/marketing"
          icon={Megaphone}
          label="Marketing"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/marketing/instagram"
          icon={Instagram}
          label="Instagram Publisher"
          disabled={needsOrg}
          collapsed={collapsed}
        />
        <NavItem
          to="/marketing/facebook"
          icon={Facebook}
          label="Facebook Publisher"
          disabled={needsOrg}
          collapsed={collapsed}
        />

        {(() => {
          const items = [
            { to: '/settings/calendar', key: 'calendar', label: 'Calendar' },
            { to: '/settings/facebook', key: 'facebook', label: 'Facebook' },
            { to: '/settings/instagram', key: 'instagram', label: 'Instagram' },
            { to: '/settings/whatsapp', key: 'whatsapp', label: 'WhatsApp' },
          ];
          const visible = items.filter((i) => canUse(org, i.key, limitKeyFor(i.key)));
          return visible.map((i) => (
            <NavItem
              key={i.key}
              to={i.to}
              icon={SettingsIcon}
              label={i.label}
              collapsed={collapsed}
              testId={`nav-${i.key}`}
            />
          ));
        })()}

        {(canViewOrganizationsAdmin(user) || isSuperAdmin) && (
          <>
            <div className="mt-3 text-xs uppercase text-gray-500 px-3">
              {collapsed ? 'A' : 'Admin'}
            </div>
            <NavItem
              to="/admin/organizations"
              icon={Building2}
              label="Organizações"
              collapsed={collapsed}
            />
            <NavItem
              to="/admin/plans"
              icon={CreditCard}
              label="Planos"
              collapsed={collapsed}
            />
          </>
        )}
      </div>

      <div className="p-3 border-t">
        {user && (
          <button
            type="button"
            onClick={logout}
            className={`flex items-center w-full rounded px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors ${
              collapsed ? 'justify-center' : 'gap-2'
            }`}
            aria-label="Sair"
          >
            <LogOut size={18} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sair</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

