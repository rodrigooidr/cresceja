// frontend/src/hooks/useActiveOrgGate.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hasRoleAtLeast, ROLES } from "../auth/roles";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext.jsx";

/**
 * Hook imperativo para proteger páginas (fora do router).
 * Redireciona se:
 * - não autenticado
 * - sem papel mínimo
 * - sem organização (para papéis abaixo de Support/SuperAdmin)
 */
export default function useActiveOrgGate(options = {}) {
  const {
    minRole = ROLES.Agent,
    redirectNoAuth = "/login",
    redirectNoPerm = "/403",
    redirectNoOrg = "/onboarding", // ou '/select-org'
    mode = "redirect", // 'redirect' | 'silent'
  } = options;

  const navigate = useNavigate();
  const { user: me, loading } = useAuth();
  const { selected } = useOrg(); // org ativa escolhida no sidebar

  const isPlatformPrivileged =
    me?.role === ROLES.SuperAdmin || me?.role === ROLES.Support;

  const hasOrg = isPlatformPrivileged ? true : Boolean(selected || me?.org_id);
  const allowed = !!me && hasRoleAtLeast(me.role, minRole) && hasOrg;

  useEffect(() => {
    if (mode !== "redirect") return;
    if (loading) return;

    if (!me) {
      navigate(redirectNoAuth, { replace: true });
      return;
    }
    if (!hasRoleAtLeast(me.role, minRole)) {
      navigate(redirectNoPerm, { replace: true });
      return;
    }
    if (!hasOrg) {
      navigate(redirectNoOrg, { replace: true });
    }
  }, [mode, loading, me, minRole, navigate, redirectNoAuth, redirectNoPerm, redirectNoOrg, hasOrg]);

  return { me, allowed, hasOrg, isPlatformPrivileged };
}
