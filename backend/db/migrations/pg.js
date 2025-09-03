// backend/db/pg.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ou defina user, password, host, port, database individualmente
  // ssl: { rejectUnauthorized: false } // se precisar (ex: Railway/Render)
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const dur = Date.now() - start;
  if (dur > 500) {
    // eslint-disable-next-line no-console
    console.warn(`[pg] slow query ${dur}ms: ${text}`);
  }
  return res;
}

export default { query, pool };
