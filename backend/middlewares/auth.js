import { authRequired } from '../middleware/auth.js';

export function requireAuth(req, res, next) {
  if (typeof authRequired === 'function') {
    return authRequired(req, res, next);
  }
  if (req?.user?.id) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export function requireSuperAdmin(req, res, next) {
  const roles = new Set([req?.user?.role, ...(req?.user?.roles || [])].filter(Boolean));
  if (roles.has('SuperAdmin')) return next();
  return res.status(403).json({ error: 'forbidden' });
}
