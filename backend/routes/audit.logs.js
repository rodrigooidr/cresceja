import express from 'express';
import { pool } from '#db';
import * as authModule from '../middleware/auth.js';
import { requireRole as defaultRequireRole } from '../middleware/requireRole.js';
import { ROLES as DefaultRoles } from '../lib/permissions.js';

function resolveAuth(requireAuth) {
  return (
    requireAuth ||
    authModule?.requireAuth ||
    authModule?.authRequired ||
    authModule?.default ||
    ((_req, _res, next) => next())
  );
}

function resolveRoleGuard(requireRole, roles) {
  const factory = typeof requireRole === 'function' ? requireRole : defaultRequireRole;
  const superAdmin = roles?.SuperAdmin ?? 'SuperAdmin';
  const orgAdmin = roles?.OrgAdmin ?? 'OrgAdmin';
  return factory(superAdmin, orgAdmin);
}

function resolveDb(req, db) {
  if (req?.db && typeof req.db.query === 'function') return req.db;
  return db && typeof db.query === 'function' ? db : pool;
}

export default function createAuditLogsRouter({ db = pool, requireAuth, requireRole, ROLES } = {}) {
  const router = express.Router();
  const authMiddleware = resolveAuth(requireAuth);
  const roles = { ...DefaultRoles, ...(ROLES || {}) };
  const roleMiddleware = resolveRoleGuard(requireRole, roles);

  router.get('/api/audit/logs', authMiddleware, roleMiddleware, async (req, res, next) => {
    try {
      const database = resolveDb(req, db);
      if (!database || typeof database.query !== 'function') {
        throw new Error('database client not available');
      }

      const rawLimit = req.query?.limit;
      const parsedLimit =
        typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : Number(rawLimit);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
      const lim = Math.max(1, Math.min(limit, 200));
      const action = (req.query?.action ? String(req.query.action).trim() : '') || null;
      const orgId = req.user?.orgId ?? req.user?.org_id ?? req.orgId ?? null;

      if (!orgId) {
        return res.status(400).json({ error: 'org_required' });
      }

      const params = [orgId, lim];
      let sql =
        'SELECT created_at, user_id, action, entity, entity_id, payload FROM audit_logs WHERE org_id = $1';

      if (action) {
        sql += ' AND action = $3';
        params.push(action);
      }

      sql += ' ORDER BY created_at DESC LIMIT $2';

      const { rows } = await database.query(sql, params);
      return res.json({ items: rows || [] });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
