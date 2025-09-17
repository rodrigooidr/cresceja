const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.inbox_ai_flags (
    id SERIAL PRIMARY KEY,
    scope TEXT NOT NULL,
    chat_id TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (scope, chat_id)
  )`;

let ensured = false;
async function ensureTable(pool) {
  if (ensured) return;
  await pool.query(TABLE_SQL);
  ensured = true;
}

async function getGlobal(pool) {
  await ensureTable(pool);
  const { rows } = await pool.query(
    `SELECT enabled FROM public.inbox_ai_flags WHERE scope = 'global' LIMIT 1`
  );
  return !!rows[0]?.enabled;
}

async function setGlobal(pool, enabled) {
  await ensureTable(pool);
  await pool.query(
    `INSERT INTO public.inbox_ai_flags (scope, chat_id, enabled, created_at, updated_at)
     VALUES ('global', NULL, $1, now(), now())
     ON CONFLICT (scope, chat_id)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
    [enabled]
  );
}

async function getPerChat(pool, chatId) {
  if (!chatId) return false;
  await ensureTable(pool);
  const { rows } = await pool.query(
    `SELECT enabled FROM public.inbox_ai_flags WHERE scope = 'chat' AND chat_id = $1 LIMIT 1`,
    [chatId]
  );
  return !!rows[0]?.enabled;
}

async function setPerChat(pool, chatId, enabled) {
  if (!chatId) return;
  await ensureTable(pool);
  await pool.query(
    `INSERT INTO public.inbox_ai_flags (scope, chat_id, enabled, created_at, updated_at)
     VALUES ('chat', $1, $2, now(), now())
     ON CONFLICT (scope, chat_id)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
    [chatId, enabled]
  );
}

module.exports = {
  getGlobal,
  setGlobal,
  getPerChat,
  setPerChat,
};
