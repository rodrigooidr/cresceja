const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.inbox_idempotency (
    key TEXT PRIMARY KEY,
    response_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;

let ensured = false;
async function ensureTable(pool) {
  if (ensured) return;
  await pool.query(TABLE_SQL);
  ensured = true;
}

export async function withIdempotency(pool, key, fn) {
  if (!key) {
    return fn();
  }

  await ensureTable(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT response_json FROM public.inbox_idempotency WHERE key = $1 FOR UPDATE',
      [key]
    );
    if (rows[0]) {
      await client.query('COMMIT');
      return rows[0].response_json;
    }

    const result = await fn();
    await client.query(
      `INSERT INTO public.inbox_idempotency (key, response_json, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (key)
       DO UPDATE SET response_json = EXCLUDED.response_json, updated_at = EXCLUDED.updated_at`,
      [key, result ?? null]
    );
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}
