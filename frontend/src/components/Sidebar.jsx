// src/components/Sidebar.jsx
import React, { useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/api";
import { can, role as getRole } from "../utils/auth";
import UserSwitcher from "./UserSwitcher";

// Estilo do link
const itemClass = ({ isActive }) =>
  `group rounded px-2 py-2 transition-colors flex items-center gap-2
   ${isActive ? "font-semibold text-blue-700 bg-blue-50" : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"}`;

// Ícones (sem libs externas)
const I = {
  menu: (props) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
    </svg>
  ),
  chevronLeft: (props) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  ),
  chevronRight: (props) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path fill="currentColor" d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z" />
    </svg>
  ),
  chat: (p) => <span {...p}>💬</span>,
  crm: (p) => <span {...p}>📈</span>,
  agenda: (p) => <span {...p}>📅</span>,
  mkt: (p) => <span {...p}>📣</span>,
  approve: (p) => <span {...p}>✅</span>,
  ai: (p) => <span {...p}>🤖</span>,
  gov: (p) => <span {...p}>🛡️</span>,
  onboard: (p) => <span {...p}>🚀</span>,
  sub: (p) => <span {...p}>💳</span>,
  clients: (p) => <span {...p}>👥</span>,
  plans: (p) => <span {...p}>🧩</span>,
  usage: (p) => <span {...p}>📏</span>,
};

// Busca módulos do plano/assinatura + dias restantes
function useEntitlements() {
  const [mods, setMods] = useState({});
  const [planName, setPlanName] = useState("");
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/subscription/status");
      setMods(data?.modules || {});
      setPlanName(data?.planName || data?.plan_id || "");
      setDaysRemaining(
        typeof data?.daysRemaining === "number" ? data.daysRemaining : null
      );
    } catch {
      // silêncio: exibe vazio se der erro
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await fetchStatus();
    })();
    const reval = () => fetchStatus();
    window.addEventListener("plans-updated", reval);
    window.addEventListener("subscription-updated", reval);
    window.addEventListener("trial-updated", reval);
    return () => {
      alive = false;
      window.removeEventListener("plans-updated", reval);
      window.removeEventListener("subscription-updated", reval);
      window.removeEventListener("trial-updated", reval);
    };
  }, [fetchStatus]);

  return { mods, planName, daysRemaining, loading };
}

export default function Sidebar({ collapsed = false, onToggle }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { mods, planName, daysRemaining } = useEntitlements();
  const role = getRole(); // owner | client_admin | user | null

  // Mapa base com ícones e requisito de módulo
  const baseMenu = [
    { path: "/omnichannel/chat", label: "Atendimento", requires: "omnichannel", icon: I.chat },
    { path: "/crm/oportunidades", label: "CRM", requires: "crm", icon: I.crm },
    { path: "/agenda", label: "Agenda", icon: I.agenda },
    { path: "/marketing", label: "Marketing", requires: "marketing", icon: I.mkt },
    { path: "/aprovacao", label: "Aprovações", requires: "approvals", icon: I.approve },
    { path: "/creditos", label: "Créditos IA", requires: "ai_credits", icon: I.ai },
    { path: "/governanca", label: "Governança", requires: "governance", icon: I.gov },
    { path: "/onboarding", label: "Onboarding", icon: I.onboard },
  ];

  // Regras de visibilidade por nível
  const hasModule = (key) => {
    if (!key) return true;
    if (role === "owner") return true;
    return Boolean(mods?.[key]?.enabled);
  };
  const canSee = (item) => {
    if (!item.requires) return true;
    if (role === "owner") return true;
    if (role === "client_admin") return hasModule(item.requires);
    return hasModule(item.requires) && can(item.requires);
  };

  const filteredMenu = baseMenu.filter(canSee);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Larguras conforme estado
  const asideW = collapsed ? "w-16" : "w-52";

  return (
    <aside
      className={`${asideW} bg-white shadow h-screen p-3 fixed left-0 top-0 overflow-y-auto z-40`}
      role="navigation"
      aria-label="Menu lateral"
    >
      {/* Header com botão de colapsar */}
      <div className="flex items-center justify-between mb-2">
        <div className={`font-bold ${collapsed ? "text-sm" : "text-xl"}`}>
          {collapsed ? "CJ" : "CresceJá"}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
          title={collapsed ? "Expandir" : "Contrair"}
        >
          {collapsed ? <I.chevronRight /> : <I.chevronLeft />}
        </button>
      </div>

      {/* Badge do plano */}
      <div
        className={`text-xs text-gray-600 bg-gray-50 border rounded-lg ${
          collapsed ? "p-2 text-center" : "p-3"
        }`}
        title={collapsed ? `Plano: ${planName || "—"}` : undefined}
      >
        {collapsed ? (
          <div className="leading-none">
            <div className="font-semibold truncate">{planName ? "P" : "—"}</div>
          </div>
        ) : (
          <>
            <div>
              Plano: <span className="font-semibold">{planName || "—"}</span>
            </div>
            <div className="mt-1">
              {typeof daysRemaining === "number" ? (
                daysRemaining >= 0 ? (
                  <span>
                    Restam <span className="font-semibold">{daysRemaining}</span> dia(s)
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">Expirado</span>
                )
              ) : (
                <span className="text-gray-500">Sem data de fim</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Seleção de usuário para admins */}
      {(role === "owner" || role === "client_admin") && !collapsed && (
        <UserSwitcher />
      )}

      {/* Navegação */}
      <nav className="mt-3 flex flex-col gap-1">
        {filteredMenu.map((item) => {
          const Icon = item.icon || I.menu;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={itemClass}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}

        {/* Minha assinatura — sempre visível */}
        <NavLink
          to="/assinatura/status"
          className={itemClass}
          title={collapsed ? "Minha assinatura" : undefined}
        >
          <I.sub className="shrink-0" />
          {!collapsed && <span className="truncate">Minha assinatura</span>}
        </NavLink>

        {/* Bloco Admin (owner e client_admin) */}
        {(role === "owner" || role === "client_admin") && (
          <>
            {!collapsed && (
              <div className="h-px bg-gray-200 my-2" aria-hidden="true" />
            )}
            {!collapsed && (
              <div className="text-[10px] uppercase tracking-wide text-gray-500 px-1">
                Admin
              </div>
            )}
            <NavLink
              to="/admin/clients"
              className={itemClass}
              title={collapsed ? "Admin • Clientes" : undefined}
            >
              <I.clients className="shrink-0" />
              {!collapsed && <span className="truncate">Admin • Clientes</span>}
            </NavLink>
            <NavLink
              to="/admin/plans"
              className={itemClass}
              title={collapsed ? "Admin • Planos" : undefined}
            >
              <I.plans className="shrink-0" />
              {!collapsed && <span className="truncate">Admin • Planos</span>}
            </NavLink>
            <NavLink
              to="/admin/usage"
              className={itemClass}
              title={collapsed ? "Admin • Regras de Uso" : undefined}
            >
              <I.usage className="shrink-0" />
              {!collapsed && (
                <span className="truncate">Admin • Regras de Uso</span>
              )}
            </NavLink>
            <NavLink
              to="/admin/integrations"
              className={itemClass}
              title={collapsed ? "Admin • Integrações" : undefined}
            >
              <I.onboard className="shrink-0" />
              {!collapsed && (
                <span className="truncate">Admin • Integrações</span>
              )}
            </NavLink>
          </>
        )}

        {/* Logout */}
        <button
          type="button"
          className={`text-sm text-red-600 text-left hover:underline mt-3 ${
            collapsed ? "px-2 py-2 flex justify-center" : "px-2 py-2"
          }`}
          onClick={() => {
            handleLogout();
          }}
          title={collapsed ? "Sair" : undefined}
        >
          {collapsed ? "⎋" : "Sair"}
        </button>
      </nav>
    </aside>
  );
}
