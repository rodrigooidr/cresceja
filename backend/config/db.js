// backend/config/db.js
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://cresceja:cresceja123@localhost:5432/cresceja_db';

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const query = (text, params) => pool.query(text, params);
export default pool;
