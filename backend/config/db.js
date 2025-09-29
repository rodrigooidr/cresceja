// backend/config/db.js
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool } = pg;

// String de conexão (fallback local)
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://cresceja:cresceja123@localhost:5432/cresceja_db';

// Pool único
export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? process.env.PG_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT ?? process.env.PG_IDLE ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT ?? 10_000),
  application_name: process.env.PG_APP || 'cresceja-backend',
  ssl:
    process.env.PG_SSL === 'true' || process.env.PGSSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});

// Ajustes por conexão (sessão)
pool.on('connect', async (client) => {
  try {
    // UTC por padrão (evita surpresas com timestamps)
    await client.query(`SET TIME ZONE 'UTC'`);
    // statement_timeout opcional (ms)
    const to = Number(process.env.PG_STATEMENT_TIMEOUT_MS || 0);
    if (to > 0) {
      await client.query(`SET statement_timeout = $1`, [to]);
    }
  } catch (err) {
    // não derruba o servidor por falha de SET; apenas loga
    // eslint-disable-next-line no-console
    console.warn('[pg] session setup failed:', err?.message);
  }
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[pg] pool error', err);
});

// AsyncLocalStorage para “fixar” o client por request
export const als = new AsyncLocalStorage();

/**
 * query(text, params)
 * - Se houver client no ALS (pgRlsContext), usa esse client (com SET LOCAL já aplicado)
 * - Caso contrário, usa pool.query (ex.: rotas públicas/health/jobs)
 */
export async function query(text, params) {
  const store = als.getStore();
  const client = store?.client;
  const start = Date.now();
  const slowMs = Number(process.env.PG_SLOW_MS || 250);
  try {
    const res = client ? await client.query(text, params) : await pool.query(text, params);

    const dur = Date.now() - start;
    if (dur > slowMs) {
      // Loga só a 1ª linha do SQL para não poluir
      // eslint-disable-next-line no-console
      console.warn('[pg] slow query', dur, 'ms →', String(text).split('\n')[0]);
    }
    return res;
  } catch (err) {
    if (err?.code === '22P02') {
      // eslint-disable-next-line no-console
      console.error('[pg] 22P02 invalid_text_representation');
      // eslint-disable-next-line no-console
      console.error('[pg] 22P02 text:', text);
      // eslint-disable-next-line no-console
      console.error('[pg] 22P02 params:', params);
    }
    throw err;
  }
}

/** Healthcheck simples, útil no boot do servidor */
export async function healthcheck() {
  const c = await pool.connect();
  try {
    await c.query('SELECT 1');
  } finally {
    c.release();
  }
  return true;
}

/** Acesso direto ao Pool (evite em rotas com RLS) */
export function getDb() {
  return pool;
}

/** Pega um client manualmente (lembre: client.release()) */
export async function getClient() {
  return pool.connect();
}

/**
 * withTransaction(fn, { client })
 * - Se receber client, usa o client fornecido
 * - Senão, abre um client novo, BEGIN/COMMIT automaticamente
 * - Útil para tarefas assíncronas fora do ciclo HTTP (workers/jobs)
 */
export async function withTransaction(fn, opts = {}) {
  const extClient = opts.client;
  const client = extClient || (await pool.connect());
  const mustRelease = !extClient;

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    if (mustRelease) client.release();
  }
}

/** Ping simples (boolean) */
export async function ping() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

/** Encerramento gracioso */
export async function closePool() {
  await pool.end();
}

// Export default para compat
export default {
  query,
  getDb,
  getClient,
  withTransaction,
  pool,
  ping,
  healthcheck,
  closePool,
  als,
};
