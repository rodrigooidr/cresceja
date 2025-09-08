// Garante RLS por transação com SET LOCAL (GUCs) usando ALS.
// Use após auth: app.use('/api', authRequired, impersonationGuard, pgRlsContext)

import { pool, als } from '../config/db.js';

function isGlobalAllowed(pathname) {
  // Rotas que NÃO devem exigir X-Org-Id para funcionarem (seletor de orgs, etc.)
  return (
    /^\/orgs\b/.test(pathname) // /api/orgs...
  );
}

export async function pgRlsContext(req, res, next) {
  try {
    const path = req.path || '';
    const user = req.user || {};

    const headerOrg = req.get('X-Org-Id') || null;
    const tokenOrg  = user.org_id || null;

    const routeIsGlobal = isGlobalAllowed(path);

    // Fallback padrão: header > token
    const orgId = headerOrg || tokenOrg || null;
    const role  = user.role || 'user';
    const userId = user.id || null;

    if (!orgId && !routeIsGlobal) {
      return res.status(400).json({
        error: 'org_required',
        message: 'X-Org-Id ausente e token sem org_id',
      });
    }

    const client = await pool.connect();
    let finished = false;

    als.run({ client }, async () => {
      try {
        await client.query('BEGIN');

        // Seta variáveis de sessão usadas pelas policies de RLS
        // MUITO IMPORTANTE: agora setamos também app.user_id
        if (orgId) {
          await client.query(
            `SELECT
               set_config('app.org_id',  $1, true),
               set_config('app.user_id', $2, true),
               set_config('app.role',    $3, true),
               set_config('TimeZone',    'UTC', true)`,
            [orgId, userId || '', role]
          );
        } else {
          // Rotas "globais" (ex.: /orgs): sem org_id, mas ainda informamos user/role
          await client.query(
            `SELECT
               set_config('app.user_id', $1, true),
               set_config('app.role',    'global', true),
               set_config('TimeZone',    'UTC', true)`,
            [userId || '']
          );
        }

        // (Opcional) timeout de instrução
        if (process.env.PG_STATEMENT_TIMEOUT_MS) {
          await client.query(
            `SET LOCAL statement_timeout = $1`,
            [Number(process.env.PG_STATEMENT_TIMEOUT_MS)]
          );
        }

        // compat: algumas rotas usam req.db/req.client
        req.db = client;
        req.orgId = orgId || null;

        const cleanup = async (commit) => {
          if (finished) return;
          finished = true;
          try {
            if (commit) await client.query('COMMIT');
            else        await client.query('ROLLBACK');
          } catch { /* noop */ }
          client.release();
        };

        res.on('finish', async () => {
          const ok = res.statusCode < 400;
          await cleanup(ok);
        });
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
