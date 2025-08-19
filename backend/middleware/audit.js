import { auditLog } from '../services/audit.js';

export function auditMiddleware(req, res, next) {
  const methods = ['POST', 'PUT', 'DELETE'];
  if (!methods.includes(req.method)) return next();
  const end = res.end;
  res.end = function (...args) {
    const entity = req.path.split('/')[1] || req.path;
    const entityId = req.params?.id ? Number(req.params.id) : null;
    auditLog({
      user_email: req.user?.email || null,
      action: req.method,
      entity,
      entity_id: entityId,
      payload: req.body || null,
    }).catch(() => {});
    end.apply(this, args);
  };
  next();
}
