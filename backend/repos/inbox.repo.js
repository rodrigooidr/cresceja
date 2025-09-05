// backend/repos/inbox.repo.js
import { query } from '../config/db.js';

/**
 * Lista conversas da org corrente (RLS via pgRlsContext)
 */
export async function listConversationsRepo({ status, channel, tags, q, limit = 50, cursor } = {}) {
  const params = [];
  const wheres = [`v.org_id = current_setting('app.org_id')::uuid`];

  if (status) {
    if (status === 'open') {
      wheres.push(`v.status IN ('open','pending')`);
    } else {
      params.push(status);
      wheres.push(`v.status = $${params.length}`);
    }
  }
  if (channel) { params.push(channel); wheres.push(`v.channel = $${params.length}`); }
  if (q) { params.push(`%${String(q).toLowerCase()}%`); wheres.push(`lower(c.name) LIKE $${params.length}`); }

  if (tags) {
    const arr = Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) { params.push(arr); wheres.push(`c.tags && $${params.length}::text[]`); }
  }

  params.push(Number(limit) || 50);
  const sql = `
    SELECT v.*, COALESCE(v.last_message_at, MAX(m.created_at)) AS last_message_at,
           jsonb_build_object('id', c.id, 'name', c.name, 'tags', c.tags) AS client
      FROM conversations v
      JOIN clients c ON c.id = v.client_id
      LEFT JOIN messages m ON m.conversation_id = v.id
     WHERE ${wheres.join(' AND ')}
     GROUP BY v.id, c.id
     ORDER BY COALESCE(v.last_message_at, MAX(m.created_at)) DESC NULLS LAST, v.updated_at DESC
     LIMIT $${params.length}
  `;
  const { rows } = await query(sql, params);
  return { items: rows, total: rows.length };
}

/**
 * Mensagens de uma conversa
 */
export async function getMessagesRepo({ conversation_id, limit = 50 }) {
  const { rows } = await query(
    `SELECT *
       FROM messages
      WHERE org_id = current_setting('app.org_id')::uuid
        AND conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2`,
    [conversation_id, Number(limit) || 50]
  );
  const items = rows.map((m) => ({
    ...m,
    direction_norm: m.direction === 'outbound' ? 'out' : m.direction === 'inbound' ? 'in' : m.direction,
  }));
  return { items, total: items.length };
}

/**
 * Zera não lidas da conversa
 */
export async function markConversationReadRepo({ conversation_id }) {
  await query(
    `UPDATE conversations
        SET unread_count = 0,
            updated_at = now()
      WHERE org_id = current_setting('app.org_id')::uuid
        AND id = $1`,
    [conversation_id]
  );
  return { ok: true, id: conversation_id };
}

/**
 * Dados do cliente da conversa
 */
export async function getClientRepo({ conversation_id }) {
  const { rows } = await query(
    `SELECT c.*
       FROM clients c
       JOIN conversations v ON v.client_id = c.id
      WHERE v.org_id = current_setting('app.org_id')::uuid
        AND v.id = $1`,
    [conversation_id]
  );
  return rows[0] || null;
}

/**
 * Atualiza campos do cliente vinculado à conversa
 */
export async function upsertClientRepo({ conversation_id, updates = {} }) {
  const { rows: cv } = await query(
    `SELECT client_id
       FROM conversations
      WHERE org_id = current_setting('app.org_id')::uuid
        AND id = $1`,
    [conversation_id]
  );
  if (!cv.length) throw new Error('conversation not found');
  const clientId = cv[0].client_id;

  if (!updates || Object.keys(updates).length === 0) {
    const { rows } = await query(
      `SELECT * FROM clients WHERE org_id = current_setting('app.org_id')::uuid AND id = $1`,
      [clientId]
    );
    return rows[0] || null;
  }

  const fields = [];
  const params = [clientId];
  for (const [key, value] of Object.entries(updates)) {
    params.push(value);
    const idx = params.length;
    if (key === 'tags') fields.push(`tags = $${idx}::text[]`);
    else fields.push(`${key} = $${idx}`);
  }
  const sql = `UPDATE clients SET ${fields.join(', ')}, updated_at = now() WHERE org_id = current_setting('app.org_id')::uuid AND id = $1 RETURNING *`;
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

/**
 * Cria mensagem e atualiza a conversa
 */
export async function createMessageRepo({ conversation_id, text, author_id = 'me', direction = 'outbound', sender = 'agent' }) {
  const { rows } = await query(
    `INSERT INTO messages (org_id, conversation_id, author_id, direction, sender, text)
     VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4, $5)
     RETURNING *`,
    [conversation_id, author_id, direction, sender, text ?? '']
  );

  await query(
    `UPDATE conversations
        SET last_message_at = now(),
            unread_count = CASE WHEN $2 IN ('in','inbound') THEN unread_count + 1 ELSE unread_count END,
            updated_at = now()
      WHERE org_id = current_setting('app.org_id')::uuid
        AND id = $1`,
    [conversation_id, direction]
  );

  return rows[0];
}
