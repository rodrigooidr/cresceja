// backend/services/conversationsService.js
import { query } from '../config/db.js';

export async function listConversations(orgId, { q, status, tags, limit = 30, cursor }) {
  const params = [orgId];
  let where = 'c.org_id = $1';
  if (status) { params.push(status); where += ` AND c.status = $${params.length}`; }
  if (q) { params.push(`%${q}%`); where += ` AND (coalesce(ct.name,'') ILIKE $${params.length} OR coalesce(ct.phone_e164,'') ILIKE $${params.length})`; }
  // tags (simples: intersect)
  if (tags && tags.length) { params.push(tags); where += ` AND ct.tags && $${params.length}`; }

  const sql = `
    SELECT c.id, c.channel, c.status, c.ai_enabled, c.unread_count, c.last_message_at,
           jsonb_build_object('id', ct.id, 'name', ct.name, 'photo_url', ct.photo_url, 'phone_e164', ct.phone_e164, 'tags', ct.tags) AS contact
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    WHERE ${where}
    ORDER BY coalesce(c.last_message_at, c.created_at) DESC
    LIMIT ${limit}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

export async function getConversation(orgId, id) {
  const { rows } = await query(
    `SELECT c.*, jsonb_build_object('id', ct.id, 'name', ct.name, 'photo_url', ct.photo_url, 'phone_e164', ct.phone_e164, 'tags', ct.tags) AS contact
     FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
     WHERE c.org_id = $1 AND c.id = $2`, [orgId, id]
  );
  return rows[0];
}

export async function listMessages(orgId, conversationId, { limit = 50, before }) {
  const params = [orgId, conversationId];
  let where = 'm.org_id = $1 AND m.conversation_id = $2';
  if (before) { params.push(before); where += ` AND m.created_at < $${params.length}`; }
  const { rows } = await query(
    `SELECT id, "from", provider, type, text, attachments, status, transcript, meta, created_at
     FROM messages m WHERE ${where}
     ORDER BY created_at DESC LIMIT ${limit}`, params);
  return rows;
}

export async function appendMessage(orgId, conversationId, from, payload) {
  const { type, text, attachments = null, status = 'sent', meta = null } = payload;
  const { rows } = await query(
    `INSERT INTO messages (org_id, conversation_id, "from", provider, type, text, attachments, status, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, status, created_at`,
    [orgId, conversationId, from, 'wa', type, text || null, attachments, status, meta]
  );
  await query('UPDATE conversations SET last_message_at = now() WHERE id = $1 AND org_id = $2', [conversationId, orgId]);
  return rows[0];
}
