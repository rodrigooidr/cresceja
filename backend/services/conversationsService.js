// backend/services/conversationsService.js
import { query as rootQuery } from '../config/db.js';

/**
 * IMPORTANTE:
 * Sempre que possível, passe o `db` transacional (req.db) vindo do pgRlsContext.
 * Se cair no fallback (rootQuery/pool), você perde as GUCs (app.org_id etc.)
 * e, portanto, o comportamento RLS/escopo por organização.
 */
function q(db) {
  if (db && typeof db.query === 'function') {
    return (text, params) => db.query(text, params);
  }
  // Fallback: funciona, mas sem RLS. Use apenas para scripts utilitários.
  return (text, params) => rootQuery(text, params);
}

const PROVIDER_CASE_SQL = `
  CASE
    WHEN lower(ch.type) IN ('wa','whatsapp','whatsapp_cloud','whatsapp_baileys') THEN 'wa'
    WHEN lower(ch.type) IN ('ig','instagram') THEN 'ig'
    WHEN lower(ch.type) IN ('fb','facebook') THEN 'fb'
    ELSE 'wa'
  END
`;

/**
 * Lista conversas da organização.
 * Respeita RLS quando `db` é o client da transação (req.db).
 */
export async function listConversations(db, orgId, { q: search, status, tags, limit = 30 } = {}) {
  const run = q(db);
  const params = [orgId];
  let where = 'c.org_id = $1';

  if (status) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    // usa o MESMO placeholder para name e phone (mesmo valor)
    where += ` AND (
      COALESCE(ct.name,'') ILIKE $${params.length}
      OR COALESCE(ct.phone_e164,'') ILIKE $${params.length}
    )`;
  }

  if (tags && tags.length) {
    // cast explícito para evitar "operator does not exist: text[] && unknown"
    params.push(tags);
    where += ` AND COALESCE(ct.tags, '{}'::text[]) && $${params.length}::text[]`;
  }

  const sql = `
    SELECT
      c.id,
      c.status,
      TRUE AS ai_enabled,
      COALESCE(mu.unread_count, 0) AS unread_count,
      c.last_message_at,
      ${PROVIDER_CASE_SQL} AS provider,
      COALESCE(ch.name, 'other') AS channel,
      jsonb_build_object(
        'id',         ct.id,
        'name',       COALESCE(ct.name, 'Sem nome'),
        'photo_url',  ct.photo_url,
        'phone_e164', ct.phone_e164,
        'tags',       COALESCE(ct.tags, '{}'::text[])
      ) AS contact
    FROM conversations c
    LEFT JOIN contacts   ct ON ct.id = c.contact_id
    LEFT JOIN channels   ch ON ch.id = c.channel_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS unread_count
      FROM messages m
      WHERE m.org_id = c.org_id
        AND m.conversation_id = c.id
        AND COALESCE(m.status, 'sent') <> 'read'
    ) mu ON TRUE
    WHERE ${where}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT ${Math.max(1, Math.min(100, Number(limit) || 30))}
  `;

  const { rows } = await run(sql, params);
  return rows;
}

/**
 * Obtém uma conversa específica (da org informada).
 * LEFT JOIN em contacts para não perder conversa caso o contato esteja ausente.
 */
export async function getConversation(db, orgId, id) {
  const run = q(db);
  const { rows } = await run(
    `
    SELECT
      c.*,
      ${PROVIDER_CASE_SQL} AS provider,
      COALESCE(ch.name, 'other') AS channel,
      jsonb_build_object(
        'id',         ct.id,
        'name',       COALESCE(ct.name, 'Sem nome'),
        'photo_url',  ct.photo_url,
        'phone_e164', ct.phone_e164,
        'tags',       COALESCE(ct.tags, '{}'::text[])
      ) AS contact
    FROM conversations c
    LEFT JOIN contacts   ct ON ct.id = c.contact_id
    LEFT JOIN channels   ch ON ch.id = c.channel_id
    WHERE c.org_id = $1 AND c.id = $2
    `,
    [orgId, id]
  );
  return rows[0];
}

/**
 * Lista mensagens de uma conversa da org informada.
 * Por padrão DESC (mais novas primeiro). Ajuste se preferir ASC.
 */
export async function listMessages(db, orgId, conversationId, { limit = 50, before } = {}) {
  const run = q(db);
  const params = [orgId, conversationId];
  let where = 'm.org_id = $1 AND m.conversation_id = $2';

  if (before) {
    params.push(before);
    where += ` AND m.created_at < $${params.length}`;
  }

  const { rows } = await run(
    `
    SELECT id, "from", provider, type, text, attachments, status, transcript, meta, created_at
    FROM messages m
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(200, Number(limit) || 50))}
    `,
    params
  );
  return rows;
}

/**
 * Acrescenta mensagem a uma conversa da org informada.
 * Respeita colunas opcionais (sender/direction) quando existem.
 */
export async function appendMessage(db, orgId, conversationId, from, payload) {
  const run = q(db);
  const { type, text, attachments = null, status = 'sent', meta = null } = payload || {};

  // provider curto com base no canal da conversa
  const { rows: prov } = await run(
    `
    SELECT ${PROVIDER_CASE_SQL} AS provider
      FROM conversations c
      LEFT JOIN channels ch ON ch.id = c.channel_id
     WHERE c.org_id = $1 AND c.id = $2
    `,
    [orgId, conversationId]
  );
  const provider = prov[0]?.provider || 'wa';

  // checagens de colunas opcionais
  const hasSender = (await run(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='messages' AND column_name='sender'
     ) AS ok`
  )).rows[0]?.ok;

  const hasDirection = (await run(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='messages' AND column_name='direction'
     ) AS ok`
  )).rows[0]?.ok;

  // mapear from -> sender/direction
  let sender = null;
  let direction = null;
  if (hasSender || hasDirection) {
    if (from === 'customer') {
      sender = 'contact';
      direction = 'inbound';
    } else if (from === 'agent') {
      sender = 'agent';
      direction = 'outbound';
    } else {
      // fallback
      sender = hasSender ? 'agent' : null;
      direction = 'outbound';
    }
  }

  // Monta INSERT
  let rows;
  if (hasSender || hasDirection) {
    const cols = ['org_id','conversation_id','"from"','provider','type','text','attachments','status','meta'];
    const vals = [orgId, conversationId, from, provider, type, text || null, attachments, status, meta];

    if (hasSender)    { cols.splice(3, 0, 'sender');    vals.splice(3, 0, sender); }
    if (hasDirection) { cols.splice(4, 0, 'direction'); vals.splice(4, 0, direction); }

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const sql = `
      INSERT INTO messages (${cols.join(',')}, created_at, updated_at)
      VALUES (${placeholders}, now(), now())
      RETURNING id, status, created_at
    `;
    ({ rows } = await run(sql, vals));
  } else {
    ({ rows } = await run(
      `
      INSERT INTO messages (org_id, conversation_id, "from", provider, type, text, attachments, status, meta, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())
      RETURNING id, status, created_at
      `,
      [orgId, conversationId, from, provider, type, text || null, attachments, status, meta]
    ));
  }

  // atualiza last_message_at
  await run(
    'UPDATE conversations SET last_message_at = now() WHERE id = $1 AND org_id = $2',
    [conversationId, orgId]
  );

  return rows[0];
}
