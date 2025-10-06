// src/hooks/ActiveOrgGate.jsx
import React, { useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";

// Componente simples de fallback, se você já tiver um Forbidden, pode importar e usar no prop `fallback`
function DefaultForbidden() {
  return (
    <div style={{ padding: 16 }}>
      <h3>Acesso não permitido</h3>
      <p>Você não possui permissão para acessar esta área.</p>
    </div>
  );
}

/**
 * Gate para telas que exigem:
 *  - usuário autenticado
 *  - uma organização ativa carregada
 *  - (opcional) roles permitidas
 *
 * Props:
 *  - children: nós protegidos
 *  - allowedRoles?: string[] = ["SuperAdmin","Support","OrgOwner","OrgAdmin"]
 *  - fallback?: ReactNode (exibido quando o acesso é negado)
 *  - showWhileLoading?: ReactNode | null (UI enquanto org está carregando)
 */
export default function ActiveOrgGate({
  children,
  allowedRoles = ["SuperAdmin", "Support", "OrgOwner", "OrgAdmin"],
  fallback = <DefaultForbidden />,
  showWhileLoading = null, // pode trocar por um spinner
}) {
  const { isAuthenticated, user } = useAuth();
  const { org, orgLoading, orgError, refreshOrg, selected } = useOrg();

  // Carrega org caso o usuário esteja autenticado e ainda não tenhamos org
  useEffect(() => {
    if (isAuthenticated && !org && !orgLoading) {
      // silencioso; erros serão refletidos em orgError
      refreshOrg().catch(() => { });
    }
  }, [isAuthenticated, org, orgLoading, refreshOrg]);

  // Monte o conjunto de roles de maneira resiliente (AuthContext, user.roles e token)
  const hasAllowedRole = useMemo(() => {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;

    const roles = new Set();

    if (user?.role) roles.add(String(user.role));
    (user?.roles || []).forEach((r) => r && roles.add(String(r)));

    try {
      const t = localStorage.getItem("token");
      if (t) {
        const p = JSON.parse(
          atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        if (p?.role) roles.add(String(p.role));
        (p?.roles || []).forEach((r) => r && roles.add(String(r)));
      }
    } catch {
      // ignore
    }

    return allowedRoles.some((r) => roles.has(String(r)));
  }, [allowedRoles, user]);

  // 1) Se estamos carregando org, mostre a UI de loading e NÃO bloqueie antes da hora.
  if (orgLoading) {
    return showWhileLoading ?? <div>Carregando…</div>;
  }

  // 2) Regras mínimas
  if (!isAuthenticated) return fallback;
  if (!selected) {
    return <div>Selecione uma organização para continuar.</div>;
  }
  if (orgError) {
    return (
      <div style={{ padding: 16, color: 'crimson' }}>
        <strong>Falha ao carregar organização</strong>
        <div>{String(orgError?.message || 'Erro desconhecido')}</div>
      </div>
    );
  }
  if (!org?.id) {
    return <div>Selecione uma organização para continuar.</div>;
  }

  // 3) Roles
  if (!hasAllowedRole) return fallback;

  // 4) Acesso liberado
  //return <>{children}</>;
  return React.Children.count(children) > 0 ? <>{children}</> : <Outlet />;
}
