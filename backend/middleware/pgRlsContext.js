// Garante RLS por transação usando SET LOCAL (requer uso de req.db nos handlers)

import { pool } from '../config/db.js';

export async function pgRlsContext(req, res, next) {
  const user = req.user || {};
  const orgId = req.orgId || null;
  const role = user.role || null;

  const client = await pool.connect();
  let finished = false;

  try {
    await client.query('BEGIN');

    // Use SET LOCAL via set_config para a transação atual
    await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
    await client.query(`SELECT set_config('app.role',   $1, true)`, [role]);

    // Disponibiliza client transacional para a rota
    req.db = client;

    res.on('finish', async () => {
      if (!finished) {
        try { await client.query('COMMIT'); } finally { client.release(); }
        finished = true;
      }
    });

    res.on('close', async () => {
      if (!finished) {
        try { await client.query('ROLLBACK'); } finally { client.release(); }
        finished = true;
      }
    });

    next();
  } catch (err) {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
    next(err);
  }
}
