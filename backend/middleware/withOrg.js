import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

export function withOrg(req, res, next) {
  const headerOrg = req.headers?.['x-org-id'];
  const queryOrg = req.query?.orgId || req.params?.orgId;
  const claimOrg = req.user?.org_id || req.user?.orgId;

  req.orgId = String(headerOrg || queryOrg || claimOrg || '').trim();

  if (!req.orgId) {
    return res.status(400).json({
      error: 'missing_org',
      message: 'Envie X-Org-Id header ou orgId',
    });
  }

  return next();
}

// Middleware completo usado nas rotas que precisam de escopo/org + conexão pg
export async function withOrgScope(req, res, next) {
  try {
    withOrg(req, res, () => {});
    if (res.headersSent) return;

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
