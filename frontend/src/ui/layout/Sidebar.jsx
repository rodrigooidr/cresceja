// frontend/src/ui/layout/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useOrg } from "../../contexts/OrgContext.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { CAN_EDIT_CLIENTS, CAN_VIEW_ORGANIZATIONS_ADMIN } from "../../auth/roles";

function Item({ to, children, disabled, title }) {
  if (disabled) {
    return (
      <div className="px-3 py-2 text-gray-400 cursor-not-allowed" title={title || "Selecione uma organização"}>
        {children}
      </div>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded hover:bg-gray-100 ${isActive ? "bg-gray-100 font-medium" : ""}`
      }
    >
      {children}
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

  return (
    <nav className="h-full flex flex-col">
      <OrgPicker />

      <div className="p-3 space-y-1">
        <Item to="/inbox" disabled={needsOrg} title="Selecione uma organização para abrir o Inbox">Inbox</Item>
        {CAN_EDIT_CLIENTS(user?.role) && (
          <Item to="/clients" disabled={needsOrg} title="Selecione uma organização para ver Clientes">Clientes</Item>
        )}
        <Item to="/crm" disabled={needsOrg}>CRM</Item>
        <Item to="/integrations" disabled={needsOrg}>Integrações</Item>
        <Item to="/reports" disabled={needsOrg}>Relatórios</Item>

        {CAN_VIEW_ORGANIZATIONS_ADMIN(user?.role) && (
          <>
            <div className="mt-3 text-xs uppercase text-gray-500 px-3">Admin</div>
            <Item to="/admin/organizations" disabled={false}>Organizações</Item>
            <Item to="/admin/plans" disabled={false}>Planos (Admin)</Item>
          </>
        )}
      </div>
    </nav>
  );
}

