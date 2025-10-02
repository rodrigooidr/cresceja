const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.inbox_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event TEXT NOT NULL,
    payload JSONB,
    actor TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;

let ensured = false;
async function ensureTable(pool) {
  if (ensured) return;
  await pool.query(TABLE_SQL);
  ensured = true;
}

async function log(pool, event, payload, actor) {
  if (!event) return;
  await ensureTable(pool);
  await pool.query(
    `INSERT INTO public.inbox_audit_events (event, payload, actor, created_at)
     VALUES ($1, $2, $3, now())`,
    [event, payload || null, actor || null]
  );
}

async function list(pool, event, limit = 100) {
  await ensureTable(pool);
  const clauses = [];
  const args = [];
  let idx = 1;
  if (event) {
    clauses.push(`event = $${idx}`);
    args.push(event);
    idx += 1;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, event, payload, actor, created_at
       FROM public.inbox_audit_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
    [...args, Number.isFinite(limit) && limit > 0 ? limit : 100]
  );
  return rows;
}

export {
  log,
  list,
};
