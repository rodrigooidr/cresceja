// Autoriza por role (com override de SuperAdmin e Support com escopos)

import { ROLES, hasSupportScope } from '../lib/permissions.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user; // preenchido pelo middleware de auth
    if (!user) return res.status(401).json({ error: 'unauthenticated' });

    // SuperAdmin sempre pode
    if (user.role === ROLES.SuperAdmin) return next();

    // Support: precisa de escopo liberado para a rota (se você quiser granular, use requireScope)
    if (user.is_support) {
      // Se a rota aceitar Support sem escopo específico:
      if (allowedRoles.includes(ROLES.Support)) return next();
      // Caso contrário, bloqueia por padrão
      return res.status(403).json({ error: 'support_scope_required' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    next();
  };
}

export function requireScope(scope) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'unauthenticated' });

    if (user.role === ROLES.SuperAdmin) return next();
    if (user.is_support && hasSupportScope(user, scope)) return next();

    return res.status(403).json({ error: 'scope_forbidden', scope });
  };
}

export { ROLES };
