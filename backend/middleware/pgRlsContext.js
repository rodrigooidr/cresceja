// Garante RLS por transação com SET LOCAL, usando ALS.
// Use após auth: app.use('/api', authRequired, impersonationGuard, pgRlsContext)

import { pool, als } from '../config/db.js';

export async function pgRlsContext(req, res, next) {
  try {
    // org_id do JWT; como fallback, aceite X-Org-Id (útil p/ jobs/admin)
    const orgId = req.user?.org_id || req.headers['x-org-id'] || null;
    const role  = req.user?.role   || null;

    if (!orgId) {
      return res.status(401).json({ message: 'org_id missing in token' });
    }

    const client = await pool.connect();
    let finished = false;

    als.run({ client }, async () => {
      try {
        await client.query('BEGIN');

        // parâmetros de sessão da transação
        await client.query(`SELECT
          set_config('app.org_id', $1, true),
          set_config('app.role',   $2, true),
          set_config('TimeZone',   'UTC', true)`,
          [orgId, role || 'user']
        );
        // opcional: evite queries presas
        if (process.env.PG_STATEMENT_TIMEOUT_MS) {
          await client.query(`SET LOCAL statement_timeout = $1`, [Number(process.env.PG_STATEMENT_TIMEOUT_MS)]);
        }

        // compat: algumas rotas usam req.db/req.client
        req.db = client;

        const cleanup = async (commit) => {
          if (finished) return;
          finished = true;
          try {
            if (commit) await client.query('COMMIT');
            else        await client.query('ROLLBACK');
          } catch { /* noop */ }
          client.release();
        };

        // commit só em 2xx/3xx; erro => rollback
        res.on('finish', async () => {
          const ok = res.statusCode < 400;
          await cleanup(ok);
        });

        // conexões abortadas: rollback
        res.on('close', async () => {
          await cleanup(false);
        });

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
