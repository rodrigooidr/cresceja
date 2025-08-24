// backend/config/db.js
import pg from "pg";
const { Pool } = pg;

// String de conexão com fallback para ambiente local de desenvolvimento
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://cresceja:cresceja123@localhost:5432/cresceja_db";

// Pool de conexões configurado para aceitar variáveis de ambiente antigas e novas
export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? process.env.PG_MAX ?? 10),
  idleTimeoutMillis: Number(
    process.env.PG_IDLE_TIMEOUT ?? process.env.PG_IDLE ?? 30_000
  ),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT ?? 10_000),
  application_name: process.env.PG_APP || "cresceja-backend",
  ssl:
    process.env.PG_SSL === "true" || process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("error", (err) => {
  console.error("[pg] pool error", err);
});

// Execução de query com log simples para detecção de lentidão
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const dur = Date.now() - start;
  if (dur > 250)
    console.warn("[pg] slow query", dur, "ms", text.split("\n")[0]);
  return res;
}

export function getDb() {
  return pool;
}

export async function getClient() {
  return pool.connect(); // lembre: client.release()
}

/** Helper opcional para transações */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}

/** Ping simples (opcional) */
export async function ping() {
  const { rows } = await query("SELECT 1 AS ok");
  return rows?.[0]?.ok === 1;
}

/** Encerramento gracioso (opcional) */
export async function closePool() {
  await pool.end();
}

export default {
  query,
  getDb,
  getClient,
  withTransaction,
  pool,
  ping,
  closePool,
};
