// frontend/src/ui/layout/Sidebar.jsx
import React, { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useOrg } from "../../contexts/OrgContext.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { CAN_EDIT_CLIENTS, CAN_VIEW_ORGANIZATIONS_ADMIN } from "../../auth/roles";
import inboxApi from "../../api/inboxApi.js";
import { canUse, limitKeyFor } from "../../utils/featureGate.js";

const LS_KEY = "sidebar:collapsed";

function Item({ to, children, disabled, title, collapsed, testId }) {
  const label = typeof children === "string" ? children : "";
  const content = collapsed ? label.charAt(0) : children;
  if (disabled) {
    return (
      <div
        className="px-3 py-2 text-gray-400 cursor-not-allowed text-center opacity-60"
        title={title || "Selecione uma organização"}
        data-testid={testId}
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }
  return (
    <NavLink
      to={to}
      title={label || title}
      data-testid={testId}
      className={({ isActive }) =>
        `block px-3 py-2 rounded hover:bg-gray-100 ${
          isActive ? "bg-gray-100 font-medium" : ""
        } ${collapsed ? "text-center" : ""}`
      }
    >
      {content}
    </NavLink>
  );
}

function OrgPicker() {
  const {
    orgs, loading, selected, setSelected,
    canSeeSelector, publicMode, searchOrgs, loadMoreOrgs, hasMore, q,
  } = useOrg();
  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    const t = setTimeout(() => searchOrgs(query), 250);
    return () => clearTimeout(t);
  }, [query, searchOrgs]);

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

      {/* Busca digitável */}
      <input
        className="w-full input input-bordered"
        placeholder="Buscar cliente/empresa…"
        value={query}
        onChange={(e)=>setQuery(e.target.value)}
      />

      {/* Dropdown com opção em branco */}
      <select
        className="w-full select select-bordered"
        value={selected || ""}                 // vazio por padrão
        onChange={(e)=> setSelected(e.target.value || null)}
      >
        <option value="">{loading ? "Carregando..." : "— Selecione —"}</option>
        {orgs.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>

      {/* Paginação simples */}
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
  const { user } = useAuth();
  const { selected, publicMode } = useOrg();
  const needsOrg = !publicMode && !selected;
  const [org, setOrg] = useState(null);
  const canManageOrgAI =
    ["orgadmin", "superadmin"].includes(String(user?.role || "").toLowerCase());

  useEffect(() => {
    if (!selected) { setOrg(null); return; }
    inboxApi.get('/orgs/current', { meta:{ scope:'global' } }).then(r => setOrg(r.data));
  }, [selected]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // auto-colapse em telas menores
  useEffect(() => {
    const onResize = () =>
      setCollapsed((prev) => (window.innerWidth < 1024 ? true : prev));
    const id = requestAnimationFrame(onResize);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <nav
      className={`h-full flex flex-col ${collapsed ? "w-16" : "w-72"}`}
      data-testid="sidebar"
      aria-expanded={!collapsed}
    >
      <div className="flex items-center justify-between p-2 border-b">
        <span className="font-semibold text-sm">{collapsed ? "" : "Menu"}</span>
        <button
          data-testid="sidebar-toggle"
          className="btn btn-ghost btn-xs"
          onClick={toggle}
        >
          {collapsed ? ">>" : "<<"}
        </button>
      </div>
      <OrgPicker />

      <div className="p-3 space-y-1 flex-1 overflow-auto">
        <Item
          to="/inbox"
          disabled={needsOrg}
          title="Selecione uma organização para abrir o Inbox"
          collapsed={collapsed}
        >
          Inbox
        </Item>
        {CAN_EDIT_CLIENTS(user?.role) && (
          <Item
            to="/clients"
            disabled={needsOrg}
            title="Selecione uma organização para ver Clientes"
            collapsed={collapsed}
          >
            Clientes
          </Item>
        )}
        <Item to="/crm" disabled={needsOrg} collapsed={collapsed}>
          CRM
        </Item>
        <Item to="/integrations" disabled={needsOrg} collapsed={collapsed}>
          Integrações
        </Item>
        <Item to="/reports" disabled={needsOrg} collapsed={collapsed}>
          Relatórios
        </Item>
        <Item to="/settings" disabled={needsOrg} collapsed={collapsed}>
          Configurações
        </Item>
        {(() => {
          const aiDisabled = needsOrg || !canManageOrgAI;
          const aiTitle = !canManageOrgAI
            ? "Disponível apenas para Org Admins ou Super Admins"
            : "Selecione uma organização para acessar a IA";
          return (
            <Item
              to="/settings/ai"
              disabled={aiDisabled}
              collapsed={collapsed}
              title={aiTitle}
              testId="nav-settings-ai"
            >
              IA da Organização
            </Item>
          );
        })()}
        <Item to="/calendar" disabled={needsOrg} collapsed={collapsed}>
          Calendário
        </Item>
        <Item to="/marketing" disabled={needsOrg} collapsed={collapsed}>
          Marketing
        </Item>
        <Item to="/marketing/instagram" disabled={needsOrg} collapsed={collapsed}>
          Instagram Publisher
        </Item>
        <Item to="/marketing/facebook" disabled={needsOrg} collapsed={collapsed}>
          Facebook Publisher
        </Item>

        {(() => {
          const items = [
            { to: "/settings/calendar", key: "calendar", label: "Calendar" },
            { to: "/settings/facebook", key: "facebook", label: "Facebook" },
            { to: "/settings/instagram", key: "instagram", label: "Instagram" },
            { to: "/settings/whatsapp", key: "whatsapp", label: "WhatsApp" },
          ];
          const visible = items.filter(i => canUse(org, i.key, limitKeyFor(i.key)));
          return visible.map(i => (
            <NavLink
              key={i.key}
              to={i.to}
              data-testid={`nav-${i.key}`}
              className={`block px-3 py-2 rounded hover:bg-gray-100 ${collapsed ? "text-center" : ""}`}
            >
              {i.label}
            </NavLink>
          ));
        })()}

        {CAN_VIEW_ORGANIZATIONS_ADMIN(user?.role) && (
          <>
            <div className="mt-3 text-xs uppercase text-gray-500 px-3">
              {collapsed ? "A" : "Admin"}
            </div>
            <Item to="/admin/organizations" disabled={false} collapsed={collapsed}>
              Organizações
            </Item>
            <Item to="/admin/plans" disabled={false} collapsed={collapsed}>
              Planos
            </Item>
          </>
        )}
      </div>
    </nav>
  );
}

