// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import sidebar from '../config/sidebar';
import inboxApi from '../api/inboxApi';
import { hasPerm } from '@/auth/permCompat';
import { hasGlobalRole, hasOrgRole } from '@/auth/roles';
import { listMyOrgs } from '@/api/orgsApi'; // <-- NOVO: usa /api/orgs

const ORG_ADMIN_ROLES = ['OrgAdmin', 'OrgOwner'];
const ORG_AGENT_ROLES = ['OrgAgent', 'OrgAdmin', 'OrgOwner'];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const hasFeature = (flag) => !flag || user?.features?.[flag];

  const [me, setMe] = useState(null);
  const authSource = useMemo(() => (me ? me : user ? user : null), [me, user]);

  // ---- ORGS no sidebar (seletor) ----
  const [orgs, setOrgs] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState(
    () => localStorage.getItem('orgId') || ''
  );

  useEffect(() => {
    let cancelled = false;

    // carrega /auth/me
    (async () => {
      try {
        const { data } = await inboxApi.get('/auth/me');
        if (!cancelled) setMe(data);
      } catch (e) {
        console.error('auth_me_failed', e);
      }
    })();

    // carrega lista de organizações visíveis p/ o usuário
    (async () => {
      try {
        const items = await listMyOrgs('active');
        if (cancelled) return;

        setOrgs(items || []);

        // se não existe org selecionada, seta a primeira
        const saved = localStorage.getItem('orgId');
        if (!saved && items?.length) {
          localStorage.setItem('orgId', items[0].id);
          setCurrentOrgId(items[0].id);
        }
      } catch (e) {
        console.error('list_orgs_failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectOrg(e) {
    const orgId = e.target.value;
    setCurrentOrgId(orgId);
    localStorage.setItem('orgId', orgId);
    // força recarregar para headers X-Org-Id influenciarem o app todo
    window.location.reload();
  }

  // ---- links por permissão ----
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

  const showAdmin = authSource ? hasGlobalRole(['SuperAdmin', 'Support'], authSource) : false;

  // ---- UI: colapsa e expande no hover ----
  // Usamos "group" + "hover" do Tailwind, sem estado JS.
  // Largura padrão w-16; ao hover, w-52.
  return (
    <aside
      className="group fixed top-0 left-0 h-full bg-white border-r w-16 hover:w-52 transition-all duration-200 ease-out flex flex-col z-20"
    >
      {/* topo */}
      <div className="p-2 h-12 flex items-center justify-between border-b">
        {/* Espaço reservado para logo/ícone se quiser */}
        <div className="text-sm font-semibold text-gray-700 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          Menu
        </div>
      </div>

      {/* seletor de organização (somente fora das rotas /admin) */}
      {!isAdminRoute && (
        <div className="p-2">
          <label className="text-[11px] uppercase text-gray-500 block mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Organização
          </label>
          <div className="relative">
            {/* Quando colapsado: mostramos apenas a primeira letra da org atual dentro de um “pill” */}
            <div className="absolute inset-0 flex items-center px-2 pointer-events-none group-hover:hidden">
              <span className="text-sm font-medium text-gray-700">
                {(() => {
                  const c = orgs.find(o => o.id === currentOrgId)?.name || '';
                  return c ? c[0] : '•';
                })()}
              </span>
            </div>
            {/* Expandido (hover): select real */}
            <select
              className="hidden group-hover:block w-full text-sm border rounded px-2 py-1"
              value={currentOrgId}
              onChange={handleSelectOrg}
            >
              {orgs.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* navegação */}
      <nav className="flex-1 overflow-y-auto mt-2 px-1">
        {visibleContractLinks.length > 0 && (
          <div className="mb-3">
            <div className="px-1 text-[11px] font-semibold text-gray-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
              Navegação
            </div>
            {visibleContractLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `block rounded px-2 py-2 text-sm truncate ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
                title={label}
              >
                {/* colapsado: primeira letra, expandido: label */}
                <span className="group-hover:hidden">{label.charAt(0)}</span>
                <span className="hidden group-hover:inline">{label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {sidebar.map((section) => {
          const items = section.items.filter((item) => {
            if (!authSource) return false;

            // se não definiu roles, não bloqueia
            const okOrg = item.orgRoles ? hasOrgRole(item.orgRoles, authSource) : true;
            const okGlobal = item.globalRoles ? hasGlobalRole(item.globalRoles, authSource) : true;

            // se definiu ambos, exige pelo menos um deles
            if (item.orgRoles && item.globalRoles) {
              if (!okOrg && !okGlobal) return false;
            } else {
              if (!okOrg || !okGlobal) return false;
            }

            if (!hasFeature(item.feature)) return false;
            if (item.perm && !hasPerm(item.perm, authSource)) return false;
            return true;
          });

          if (!items.length) return null;

          return (
            <div key={section.section} className="mb-3">
              <div className="px-1 text-[11px] font-semibold text-gray-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                {section.section}
              </div>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded px-2 py-2 text-sm truncate ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                  title={item.label}
                >
                  <span className="group-hover:hidden">{item.label[0]}</span>
                  <span className="hidden group-hover:inline">{item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}

        {showAdmin && (
          <NavLink
            to="/admin/organizations"
            className={({ isActive }) =>
              `block rounded px-2 py-2 text-sm truncate ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
            title="Empresas"
          >
            <span className="group-hover:hidden">E</span>
            <span className="hidden group-hover:inline">Empresas</span>
          </NavLink>
        )}
      </nav>

      {/* rodapé */}
      <div className="p-2 border-t">
        <button
          type="button"
          onClick={logout}
          className="w-full text-left text-sm text-red-600 hover:underline truncate"
          title="Sair"
        >
          <span className="group-hover:hidden">⎋</span>
          <span className="hidden group-hover:inline">Sair</span>
        </button>
      </div>
    </aside>
  );
}
