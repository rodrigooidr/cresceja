import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

// Middleware leve: apenas garante que req.orgId seja definido caso exista no token/req
export function withOrg(req, _res, next) {
  const orgId = req.user?.org_id || req.user?.orgId || req.orgId;
  if (orgId) req.orgId = orgId;
  next();
}

// Middleware completo usado nas rotas que precisam de escopo/org + conexão pg
export async function withOrgScope(req, res, next) {
  try {
    withOrg(req, res, () => {});

    const user = req.user || {};
    let orgId = req.orgId;
    if (user.is_superadmin && req.headers['x-impersonate-org']) {
      orgId = req.headers['x-impersonate-org'];
      req.orgId = orgId;
    }
    if (!isUuid(orgId)) {
      return res.status(400).json({ error: 'org_required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.org_id = $1', [orgId]);
      req.orgId = orgId;
      req.orgScopeValidated = true;
      req.db = client;
      const { rows } = await client.query(
        'SELECT role FROM org_users WHERE org_id = $1 AND user_id = $2',
        [orgId, user.id]
      );
      let role = rows[0]?.role || null;
      if (!role && user.is_superadmin) role = 'OrgOwner';
      req.orgRole = role;

      const cleanup = async (action) => {
        try {
          await client.query(action === 'commit' ? 'COMMIT' : 'ROLLBACK');
        } finally {
          client.release();
        }
      };
      res.once('finish', () => cleanup('commit'));
      res.once('close', () => cleanup('rollback'));
      next();
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      client.release();
      next(e);
    }
  } catch (err) {
    next(err);
  }
}

export default withOrgScope;
