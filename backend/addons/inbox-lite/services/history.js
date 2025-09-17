const { randomUUID } = require('crypto');

const COMPAT_ORG_ID = process.env.COMPAT_INBOX_ORG_ID || '00000000-0000-0000-0000-000000000000';

let ensured = false;
async function ensureSchema(pool) {
  if (ensured) return;
  await pool.query(`ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS chat_id TEXT`);
  await pool.query(`ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transport TEXT`);
  await pool.query(`ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS channel TEXT`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS channel TEXT`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthdate DATE`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_mime TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_filename TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS direction TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider TEXT`);
  await pool.query(`ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "from" TEXT`);
  ensured = true;
}

function normalizeChatId(chatId) {
  if (chatId && typeof chatId === 'string') return chatId;
  return `chat:${randomUUID()}`;
}

function transportToChannel(transport) {
  if (!transport) return 'whatsapp';
  if (transport === 'cloud' || transport === 'baileys') return 'whatsapp';
  return transport;
}

function providerFromTransport(transport) {
  if (transport === 'cloud' || transport === 'baileys') return 'wa';
  if (!transport) return 'wa';
  return transport.slice(0, 2);
}

function directionToFrom(direction) {
  if (direction === 'in') return 'customer';
  return 'agent';
}

async function ensureContact(pool, chatId, transport) {
  const phone = normalizeChatId(chatId);
  const { rows } = await pool.query(
    'SELECT * FROM public.contacts WHERE phone_e164 = $1 LIMIT 1',
    [phone]
  );
  if (rows[0]) return rows[0];

  const name = `Contato ${phone.slice(-4)}`;
  const channel = transportToChannel(transport);
  const insert = await pool.query(
    `INSERT INTO public.contacts (org_id, name, phone_e164, status, channel, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     RETURNING *`,
    [COMPAT_ORG_ID, name, phone, 'novo', channel]
  );
  return insert.rows[0];
}

async function ensureConversation(pool, chatId, transport) {
  await ensureSchema(pool);
  const phone = normalizeChatId(chatId);
  const channel = transportToChannel(transport);

  const { rows } = await pool.query(
    `SELECT * FROM public.conversations
      WHERE chat_id = $1 AND (($2::text IS NOT NULL AND transport = $2) OR ($2::text IS NULL AND transport IS NULL))
      LIMIT 1`,
    [phone, transport || null]
  );
  if (rows[0]) return rows[0];

  const contact = await ensureContact(pool, phone, transport);
  const result = await pool.query(
    `INSERT INTO public.conversations (org_id, contact_id, channel, status, chat_id, transport, last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, COALESCE($4, 'pending'), $5, $6, now(), now(), now())
     RETURNING *`,
    [COMPAT_ORG_ID, contact.id, channel, null, phone, transport || null]
  );
  return result.rows[0];
}

async function appendMessage(pool, conversationId, payload) {
  await ensureSchema(pool);
  const { rows: convRows } = await pool.query(
    'SELECT id, org_id, transport FROM public.conversations WHERE id = $1 LIMIT 1',
    [conversationId]
  );
  const conv = convRows[0];
  if (!conv) throw new Error('Conversation not found');

  const direction = payload.direction || 'out';
  const provider = providerFromTransport(conv.transport);
  const fromRole = directionToFrom(direction);
  const type = payload.type || (payload.media_url ? 'image' : 'text');
  const text = payload.text || null;
  const status = payload.status || 'sent';
  const media = payload.media || null;

  const inserted = await pool.query(
    `INSERT INTO public.messages (conversation_id, org_id, direction, type, text, status, provider, "from", media_url, media_mime, media_filename, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now()))
     RETURNING *`,
    [
      conversationId,
      conv.org_id,
      direction,
      type,
      text,
      status,
      provider,
      fromRole,
      media?.url || null,
      media?.mime || null,
      media?.filename || null,
      payload.created_at ? new Date(payload.created_at) : null,
    ]
  );
  return inserted.rows[0];
}

module.exports = {
  ensureConversation,
  appendMessage,
};
