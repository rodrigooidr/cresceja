// backend/middleware/pgRlsContext.js
import { pool, als } from '#db';
import { isUuid } from '../utils/isUuid.js';

export async function pgRlsContext(req, res, next) {
  try {
    const role   = req.user?.role || 'user';
    const userId = req.user?.id   || null;

    const headerOrgId = (() => {
      const headerValue =
        req.get('X-Impersonate-Org-Id') ||
        req.get('X-Org-Id') ||
        null;
      return isUuid(headerValue) ? headerValue : null;
    })();

    const impersonatedOrgId = isUuid(req.impersonatedOrgId) ? req.impersonatedOrgId : null;
    const validatedOrgId = req.orgScopeValidated && isUuid(req.orgId) ? req.orgId : null;
    const tokenOrgId = isUuid(req.user?.org_id) ? req.user.org_id : null;
    const orgId = validatedOrgId || impersonatedOrgId || headerOrgId || tokenOrgId || null;

    if (!userId) return res.status(401).json({ error: 'unauthorized', message: 'missing user id' });
    if (!orgId)   return res.status(401).json({ error: 'org_required',  message: 'missing organization id' });

    const client = await pool.connect();
    let finished = false;

    als.run({ client }, async () => {
      try {
        await client.query('BEGIN');

        // 2) Membership check (exceto SuperAdmin/Support)
        if (isUuid(orgId) && !['SuperAdmin', 'Support'].includes(role)) {
          const { rows } = await client.query(
            `SELECT 1 FROM public.org_users WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
            [orgId, userId]
          );
          if (rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(403).json({ error: 'forbidden_org', message: 'user not member of organization' });
          }
        }

        // 3) Parâmetros de sessão da transação (GUCs)
        if (isUuid(orgId)) {
          await client.query(
            `SELECT
               set_config('app.org_id',  $1, true),
               set_config('app.user_id', $2, true),
               set_config('app.role',    $3, true),
               set_config('TimeZone',    'UTC', true)`,
            [orgId, userId, role]
          );
        } else {
          await client.query(
            `SELECT
               set_config('app.org_id',  '',  true),
               set_config('app.user_id', $1, true),
               set_config('app.role',    $2, true),
               set_config('TimeZone',    'UTC', true)`,
            [userId, role]
          );
        }

        if (process.env.PG_STATEMENT_TIMEOUT_MS) {
          await client.query(`SET LOCAL statement_timeout = $1`, [Number(process.env.PG_STATEMENT_TIMEOUT_MS)]);
        }

        // Para as rotas usarem este MESMO client (mesma transação)
        req.db = client;

        const cleanup = async (commit) => {
          if (finished) return;
          finished = true;
          try { if (commit) await client.query('COMMIT'); else await client.query('ROLLBACK'); } catch {}
          client.release();
        };

        res.on('finish', async () => { await cleanup(res.statusCode < 400); });
        res.on('close',  async () => { await cleanup(false); });

        next();
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch {}
        client.release();
        next(err);
      }
    });
  } catch (e) {
    next(e);
  }
}
