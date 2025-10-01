import { newDb } from 'pg-mem';
import { randomUUID } from 'node:crypto';

export function createTestDb() {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(),
  });

  db.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date(),
  });

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  return {
    db,
    pool,
    async query(text, params) {
      return pool.query(text, params);
    },
    async close() {
      await pool.end();
    },
  };
}

export default { createTestDb };
