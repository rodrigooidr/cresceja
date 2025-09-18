// backend/middleware/requireRole.js

const ROLES = {
  SuperAdmin: 'superAdmin',
  OrgAdmin: 'orgAdmin',
  Support: 'support',
  User: 'user',
};

function getRole(user) {
  if (!user) return null;
  return user.role || (Array.isArray(user.roles) ? user.roles[0] : null);
}

function requireRole(...allowed) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      const role = getRole(req.user);

      // Sem role definido => proibido
      if (!role) {
        return res.status(403).json({ error: 'FORBIDDEN', required: allowed });
      }

      // SuperAdmin passa direto
      if (role === ROLES.SuperAdmin) return next();

      // Se não especificou allowed, ou se o role está permitido
      if (allowed.length === 0 || allowed.includes(role)) {
        return next();
      }

      return res.status(403).json({ error: 'FORBIDDEN', required: allowed });
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Verifica se o usuário de suporte possui o escopo solicitado.
 * Aceita user.supportScopes | user.support_scopes | user.scopes como:
 * - array de strings
 * - string separada por vírgula/espaço
 * - '*' para todos os escopos
 */
function hasSupportScope(user, scope) {
  if (!scope) return true; // sem escopo requerido
  const raw =
    user?.supportScopes ??
    user?.support_scopes ??
    user?.scopes ??
    [];

  if (raw === '*') return true;

  if (typeof raw === 'string') {
    const items = raw.split(/[,\s]+/).filter(Boolean);
    return items.includes(scope);
  }

  if (Array.isArray(raw)) {
    return raw.includes(scope);
  }

  return false;
}

function requireScope(scope) {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      const role = getRole(user);

      // SuperAdmin passa direto
      if (role === ROLES.SuperAdmin) return next();

      // Usuário de suporte com escopo adequado
      if ((user.is_support || role === ROLES.Support) && hasSupportScope(user, scope)) {
        return next();
      }

      return res.status(403).json({ error: 'SCOPE_FORBIDDEN', scope });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = {
  ROLES,
  requireRole,
  requireScope,
  hasSupportScope,
};
