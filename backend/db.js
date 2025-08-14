// backend/db.js  (ESM)
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // habilite se precisar
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err);
});

export default pool;
