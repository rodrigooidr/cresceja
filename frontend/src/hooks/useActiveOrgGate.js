import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasRoleAtLeast } from '../auth/roles';
// Ajuste o caminho se seu AuthContext estiver em outro lugar:
import { useAuth } from '../contexts/AuthContext';

/**
 * Garante:
 * - usuário autenticado
 * - papel mínimo (default: 'Agent')
 * - organização ativa para papéis abaixo de SuperAdmin
 * Redireciona em caso de violação.
 */
export default function useActiveOrgGate(options = {}) {
  const {
    minRole = 'Agent',
    redirectNoAuth = '/login',
    redirectNoPerm = '/403',
    redirectNoOrg = '/onboarding', // ou '/select-org'
  } = options;

  const navigate = useNavigate();
  const { user: me, loading } = useAuth?.() ?? { user: null, loading: false };

  useEffect(() => {
    if (loading) return;

    if (!me) {
      navigate(redirectNoAuth, { replace: true });
      return;
    }
    if (!hasRoleAtLeast(me.role, minRole)) {
      navigate(redirectNoPerm, { replace: true });
      return;
    }
    if (me.role !== 'SuperAdmin' && !me.org_id) {
      navigate(redirectNoOrg, { replace: true });
      return;
    }
  }, [loading, me, minRole, navigate, redirectNoAuth, redirectNoPerm, redirectNoOrg]);

  return {
    me,
    allowed: !!me && hasRoleAtLeast(me.role, minRole) && (me.role === 'SuperAdmin' || !!me.org_id),
  };
}
