// backend/config/db.js
import pg from "pg";
import { AsyncLocalStorage } from "async_hooks";

const { Pool } = pg;

// String de conexão com fallback local
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://cresceja:cresceja123@localhost:5432/cresceja_db";

// Pool de conexões
export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? process.env.PG_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT ?? process.env.PG_IDLE ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT ?? 10_000),
  application_name: process.env.PG_APP || "cresceja-backend",
  ssl:
    process.env.PG_SSL === "true" || process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

// AsyncLocalStorage para “fixar” o client por request
export const als = new AsyncLocalStorage();

pool.on("error", (err) => {
  console.error("[pg] pool error", err);
});

/**
 * query(text, params)
 * - Se houver client no ALS (pgRlsContext), usa esse client (com SET LOCAL já aplicado)
 * - Caso contrário, usa pool.query (ex.: rotas públicas/health)
 */
export async function query(text, params) {
  const store = als.getStore();
  const client = store?.client;
  const start = Date.now();

  const res = client
    ? await client.query(text, params)
    : await pool.query(text, params);

  const dur = Date.now() - start;
  if (dur > 250) {
    // Loga só a 1ª linha do SQL para não poluir
    console.warn("[pg] slow query", dur, "ms →", String(text).split("\n")[0]);
  }
  return res;
}

/**
 * getDb / getClient continuam expostos para usos pontuais (fora do ALS).
 * OBS: em rotas com RLS, **prefira sempre** `query(...)` e deixe o pgRlsContext
 * cuidar do client/transação para você.
 */
export function getDb() {
  return pool;
}

export async function getClient() {
  return pool.connect(); // lembre: client.release()
}

/**
 * withTransaction(fn, { client })
 * - Se receber client, usa o client fornecido
 * - Senão, abre um client novo, BEGIN/COMMIT automaticamente
 * - Útil para tarefas assíncronas fora do ciclo HTTP (workers)
 */
export async function withTransaction(fn, opts = {}) {
  const extClient = opts.client;
  const client = extClient || (await pool.connect());
  let mustRelease = !extClient;

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    if (mustRelease) client.release();
  }
}

/** Ping simples */
export async function ping() {
  const { rows } = await query("SELECT 1 AS ok");
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
  closePool,
  als,
};
