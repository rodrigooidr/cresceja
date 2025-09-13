// frontend/src/ui/layout/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useOrg } from "../../contexts/OrgContext.jsx";
import { useAuth } from "../../contexts/AuthContext"; // <- ajuste se seu hook estiver em outro caminho
import { CAN_EDIT_CLIENTS, CAN_VIEW_ORGANIZATIONS_ADMIN } from "../../auth/roles";

// Item padrão de navegação; se desabilitado, mostra inativo com tooltip
function Item({ to, children, disabled, title }) {
  if (disabled) {
    return (
      <div
        className="px-3 py-2 text-gray-400 cursor-not-allowed"
        title={title || "Selecione uma organização"}
      >
        {children}
      </div>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded hover:bg-gray-100 ${
          isActive ? "bg-gray-100 font-medium" : ""
        }`
      }
    >
      {children}
    </NavLink>
  );
}

// Picker embutido (usa sua API do OrgContext)
function OrgPicker() {
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

  // busca com debounce simples
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

  const selectedName =
    selected ? orgs.find((o) => o.id === selected)?.name || "Selecionada" : "Nenhuma selecionada";

  return (
    <div className="p-3 border-b space-y-2">
      <div className="text-xs text-gray-500">Organização</div>

      <div className="px-3 py-2 rounded bg-gray-50 truncate" title={selectedName}>
        {selectedName}
      </div>

      <input
        className="w-full input input-bordered"
        placeholder="Buscar cliente/empresa…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="max-h-56 overflow-auto border rounded">
        {loading && <div className="p-2 text-sm text-gray-500">Carregando…</div>}
        {!loading && orgs.length === 0 && (
          <div className="p-2 text-sm text-gray-500">Nenhum resultado</div>
        )}
        {!loading &&
          orgs.map((r) => (
            <button
              key={r.id}
              className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                selected === r.id ? "bg-gray-100" : ""
              }`}
              onClick={() => setSelected(r.id)}
            >
              {r.name}
            </button>
          ))}
        {hasMore && (
          <button
            className="w-full text-center py-2 text-sm hover:bg-gray-50"
            onClick={loadMoreOrgs}
          >
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
        <Item to="/inbox" disabled={needsOrg} title="Selecione uma organização para abrir o Inbox">
          Inbox
        </Item>

        {CAN_EDIT_CLIENTS(user?.role) && (
          <Item to="/clients" disabled={needsOrg} title="Selecione uma organização para ver Clientes">
            Clientes
          </Item>
        )}

        <Item to="/crm" disabled={needsOrg}>
          CRM
        </Item>
        <Item to="/integrations" disabled={needsOrg}>
          Integrações
        </Item>
        <Item to="/reports" disabled={needsOrg}>
          Relatórios
        </Item>

        {CAN_VIEW_ORGANIZATIONS_ADMIN(user?.role) && (
          <>
            <div className="mt-3 text-xs uppercase text-gray-500 px-3">Admin</div>
            <Item to="/admin/organizations" disabled={false}>
              Organizações
            </Item>
            <Item to="/admin/plans" disabled={false}>
              Planos (Admin)
            </Item>
          </>
        )}
      </div>
    </nav>
  );
}
