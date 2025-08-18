// backend/config/db.js
import pg from "pg";
const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://cresceja:cresceja123@localhost:5432/cresceja_db";

export const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT ?? 10_000),
});

export const query = (text, params) => pool.query(text, params);

/** Helper opcional para transações */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
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
