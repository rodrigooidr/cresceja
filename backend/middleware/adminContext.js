import { pool } from '../config/db.js';

// backend/middleware/adminContext.js
// Provides a global transaction with role "super" and no org scope
export function adminContext(req, res, next) {
  pool.connect().then(async (client) => {
    req.db = client;
    await client.query('BEGIN');
    await client.query(`
      SELECT
        set_config('app.role', 'super', true),
        set_config('app.org_id', '', true),
        set_config('TimeZone', 'UTC', true)
    `);
    const cleanup = async (commit) => {
      try {
        if (commit) await client.query('COMMIT');
        else await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    };
    res.on('finish', () => cleanup(res.statusCode < 400));
    res.on('close', () => cleanup(false));
    next();
  }).catch(next);
}
