// backend/middleware/pgRlsContext.js
// Garante RLS por transação usando SET LOCAL (via set_config) e AsyncLocalStorage.
// Requer que o app use: app.use('/api', authRequired, impersonationGuard, pgRlsContext)

import { pool, als } from '../config/db.js';

export async function pgRlsContext(req, res, next) {
  try {
    // org vem do token (ou do impersonationGuard, se SuperAdmin/Support)
    const orgId = req.user?.org_id || null;
    const role  = req.user?.role || null;

    if (!orgId) {
      // Rotas /api protegidas exigem org; se precisar abrir exceção, marque req.skipRls = true antes deste middleware
      return res.status(401).json({ message: 'org_id missing in token' });
    }

    const client = await pool.connect();
    let finished = false;

    // Amarra o client a este request; o db.query(...) passa a usar este client
    als.run({ client }, async () => {
      try {
        await client.query('BEGIN');
        // SET LOCAL (usando set_config para permitir bind de parâmetro)
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
        if (role) {
          await client.query(`SELECT set_config('app.role',   $1, true)`, [role]);
        }

        // Compat: alguns handlers podem usar req.db diretamente
        req.db = client;

        // Commit/liberação ao fim do ciclo
        res.on('finish', async () => {
          if (finished) return;
          finished = true;
          try { await client.query('COMMIT'); } catch {}
          client.release();
        });

        // Rollback em encerramento abrupto
        res.on('close', async () => {
          if (finished) return;
          finished = true;
          try { await client.query('ROLLBACK'); } catch {}
          client.release();
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
