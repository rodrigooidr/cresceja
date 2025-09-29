import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

export async function withOrg(req, res, next) {
  try {
    const user = req.user || {};
    let orgId = user.org_id;
    if (user.is_superadmin && req.headers['x-impersonate-org']) {
      orgId = req.headers['x-impersonate-org'];
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
      try { await client.query('ROLLBACK'); } catch {}
      client.release();
      next(e);
    }
  } catch (err) {
    next(err);
  }
}
