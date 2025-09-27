// frontend/src/hooks/useActiveOrgGate.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hasOrgRole, hasGlobalRole } from "../auth/roles";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext.jsx";

/**
 * Normaliza nomes legados para o padrão atual (PascalCase de org).
 * Aceita: 'Agent' | 'Admin' | 'Owner' | 'Viewer' | 'OrgAgent' | ...
 */
function normalizeMinRole(minRole) {
  const map = {
    Viewer: "OrgViewer",
    Agent: "OrgAgent",
    Admin: "OrgAdmin",
    Owner: "OrgOwner",
    OrgViewer: "OrgViewer",
    OrgAgent: "OrgAgent",
    OrgAdmin: "OrgAdmin",
    OrgOwner: "OrgOwner",
  };
  return map[minRole] || "OrgAdmin"; // default seguro
}

/**
 * Verifica se o papel da ORG do usuário atende a um "mínimo"
 * via lista de aceitação (sem hierarquia global).
 */
function hasOrgRoleAtLeast(minRole, source) {
  const allowMap = {
    OrgViewer: ["OrgViewer", "OrgAgent", "OrgAdmin", "OrgOwner"],
    OrgAgent: ["OrgAgent", "OrgAdmin", "OrgOwner"],
    OrgAdmin: ["OrgAdmin", "OrgOwner"],
    OrgOwner: ["OrgOwner"],
  };
  const allow = allowMap[minRole] || [];
  return allow.length ? hasOrgRole(allow, source) : false;
}

/**
 * Hook imperativo para proteger páginas (fora do router).
 * Redireciona se:
 * - não autenticado
 * - sem papel mínimo
 * - sem organização (para quem não é Support/SuperAdmin)
 */
export default function useActiveOrgGate(options = {}) {
  const {
    // No legado era 'Agent'; aqui normalizamos para o padrão novo.
    minRole = "Agent",
    redirectNoAuth = "/login",
    redirectNoPerm = "/403",
    redirectNoOrg = "/onboarding", // ou '/select-org'
    mode = "redirect", // 'redirect' | 'silent'
    requireActiveOrg = true,
  } = options;

  const navigate = useNavigate();
  const { user: me, loading } = useAuth();
  const { selected } = useOrg(); // org ativa escolhida no sidebar

  // Privilégio de plataforma vem de roles GLOBAIS no JWT (não de me.role).
  const isPlatformPrivileged =
    hasGlobalRole("SuperAdmin", me) || hasGlobalRole("Support", me);

  // Se for SuperAdmin/Support, não exigimos org ativa.
  const hasOrg = isPlatformPrivileged ? true : Boolean(selected || me?.org_id);

  // Checagem do mínimo exigido na organização (normalizando legacy -> Org*)
  const minOrgRole = normalizeMinRole(minRole);
  const hasRole = !!me && hasOrgRoleAtLeast(minOrgRole, me);

  const allowed = hasRole;

  useEffect(() => {
    if (mode !== "redirect") return;
    if (loading) return;

    if (!me) {
      navigate(redirectNoAuth, { replace: true });
      return;
    }
    if (!hasRole) {
      navigate(redirectNoPerm, { replace: true });
      return;
    }
    if (requireActiveOrg && !hasOrg) {
      navigate(redirectNoOrg, { replace: true });
    }
  }, [
    mode,
    loading,
    me,
    hasRole,
    navigate,
    redirectNoAuth,
    redirectNoPerm,
    redirectNoOrg,
    hasOrg,
    requireActiveOrg,
  ]);

  return { me, allowed, hasOrg, isPlatformPrivileged };
}
