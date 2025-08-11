// backend/config/db-client.js (ESM)
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 5000),
  application_name: process.env.PG_APP || 'cresceja-backend',
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[pg] pool error', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const dur = Date.now() - start;
  if (dur > 250) console.warn('[pg] slow query', dur, 'ms', text.split('\n')[0]);
  return res;
}

export function getDb() {
  return pool;
}

export async function getClient() {
  return pool.connect(); // lembre: client.release()
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { try { await pool.end(); } finally { process.exit(0); } });
}

export default { query, getDb, getClient, withTransaction };