// frontend/src/ui/layout/Sidebar.jsx
import React, { useEffect, useState, useCallback } from "react";
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
import { CAN_EDIT_CLIENTS, CAN_VIEW_ORGANIZATIONS_ADMIN } from "../../auth/roles";
import inboxApi from "../../api/inboxApi.js";
import { canUse, limitKeyFor } from "../../utils/featureGate.js";

const LS_KEY = "sidebarCollapsed";
const LEGACY_KEY = "sidebar:collapsed";

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
  const {
    orgs,
    loading,
    selected,
    setSelected,
    canSeeSelector,
    publicMode,
    searchOrgs,
    loadMoreOrgs,
    hasMore,
    q,
  } = useOrg();
  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    const t = setTimeout(() => searchOrgs(query), 250);
    return () => clearTimeout(t);
  }, [query, searchOrgs]);

  if (collapsed) {
    if (publicMode || !canSeeSelector) {
      return (
        <div className="p-3 border-b flex items-center justify-center text-xs text-gray-500">
          Público
        </div>
      );
    }
    const active = orgs.find((o) => String(o.id) === String(selected));
    return (
      <div className="p-3 border-b flex items-center justify-center text-xs font-semibold">
        <span title={active?.name || "Selecione uma organização"}>
          {(active?.name || "Org").slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  if (publicMode || !canSeeSelector) {
    return (
      <div className="p-3 border-b space-y-2">
        <div className="text-xs text-gray-500">Organização</div>
        <div className="px-3 py-2 rounded bg-gray-50">Modo público</div>
      </div>
    );
  }

  return (
    <div className="p-3 border-b space-y-2">
      <div className="text-xs text-gray-500">Organização</div>

      <input
        className="w-full input input-bordered"
        placeholder="Buscar cliente/empresa…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <select
        className="w-full select select-bordered"
        value={selected || ""}
        onChange={(e) => setSelected(e.target.value || null)}
      >
        <option value="">{loading ? "Carregando..." : "— Selecione —"}</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="text-xs text-gray-500">
        {!loading && orgs.length === 0 && "Nenhum resultado"}
        {hasMore && (
          <button className="btn btn-ghost btn-xs ml-2" onClick={loadMoreOrgs}>
            Carregar mais…
          </button>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { selected, publicMode } = useOrg();
  const needsOrg = !publicMode && !selected;
  const [org, setOrg] = useState(null);
  const canManageOrgAI =
    ["orgadmin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const isSuperAdmin = user?.role === "SuperAdmin";

  useEffect(() => {
    if (!selected) {
      setOrg(null);
      return;
    }
    inboxApi.get('/orgs/current', { meta: { scope: 'global' } }).then((r) => setOrg(r.data)).catch(() => {});
  }, [selected]);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved != null) return saved === 'true';
      const legacy = localStorage.getItem(LEGACY_KEY);
      return legacy === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, String(collapsed));
      localStorage.removeItem(LEGACY_KEY);
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    const onResize = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 1024) {
        setCollapsed(true);
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

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <aside
      className={`h-full flex flex-col border-r bg-white ${collapsed ? 'w-16' : 'w-72'}`}
      data-testid="sidebar"
      aria-expanded={!collapsed}
      aria-label="sidebar"
    >
      <div className="flex items-center justify-between p-2 border-b">
        <span className="font-semibold text-sm">{collapsed ? '' : 'Menu'}</span>
        <button
          data-testid="sidebar-toggle"
          className="btn btn-ghost btn-xs"
          onClick={toggle}
          aria-label="Alternar menu"
        >
          {collapsed ? '>>' : '<<'}
        </button>
      </div>

      <OrgPicker collapsed={collapsed} />

      <div className="p-3 space-y-1 flex-1 overflow-auto">
        <NavItem
          to="/inbox"
          icon={MessageSquare}
          label="Inbox"
          disabled={needsOrg}
          title="Selecione uma organização para abrir o Inbox"
          collapsed={collapsed}
        />
        {CAN_EDIT_CLIENTS(user?.role) && (
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

        {(CAN_VIEW_ORGANIZATIONS_ADMIN(user?.role) || isSuperAdmin) && (
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

