import { pool } from '../db.js';

export async function listConversationsRepo({ org_id, status, channel, tags, q, limit = 50, cursor }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);

    const params = [];
    let where = `WHERE org_id = current_setting('app.org_id')::uuid`;
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (channel) { params.push(channel); where += ` AND channel = $${params.length}`; }
    if (q) { params.push(`%${q.toLowerCase()}%`); where += ` AND EXISTS (SELECT 1 FROM clients c WHERE c.id = conversations.client_id AND lower(c.name) LIKE $${params.length})`; }
    if (tags) {
      const arr = Array.isArray(tags) ? tags : String(tags).split(',').map(s=>s.trim()).filter(Boolean);
      if (arr.length) { params.push(arr); where += ` AND EXISTS (SELECT 1 FROM clients c WHERE c.id = conversations.client_id AND c.tags && $${params.length}::text[])`; }
    }

    const order = `ORDER BY last_message_at DESC NULLS LAST, updated_at DESC`;
    params.push(limit);
    const sql = `
      SELECT conversations.*, 
             jsonb_build_object('id', c.id, 'name', c.name) AS client
      FROM conversations
      JOIN clients c ON c.id = conversations.client_id
      ${where}
      ${order}
      LIMIT $${params.length}
    `;
    const { rows } = await client.query(sql, params);
    await client.query('COMMIT');

    return { items: rows, total: rows.length };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function getMessagesRepo({ org_id, conversation_id, limit = 50 }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);
    const { rows } = await client.query(
      `SELECT * FROM messages 
       WHERE org_id = current_setting('app.org_id')::uuid 
         AND conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversation_id, limit]
    );
    await client.query('COMMIT');
    return { items: rows, total: rows.length };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function markConversationReadRepo({ org_id, conversation_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);
    await client.query(
      `UPDATE conversations 
         SET unread_count = 0, updated_at = now()
       WHERE org_id = current_setting('app.org_id')::uuid
         AND id = $1`,
      [conversation_id]
    );
    await client.query('COMMIT');
    return { ok: true, id: conversation_id };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function getClientRepo({ org_id, conversation_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);
    const { rows } = await client.query(
      `SELECT c.* FROM clients c
       JOIN conversations v ON v.client_id = c.id
       WHERE v.org_id = current_setting('app.org_id')::uuid
         AND v.id = $1`,
      [conversation_id]
    );
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function upsertClientRepo({ org_id, conversation_id, name, birthdate, notes, tags }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);

    const { rows: cv } = await client.query(
      `SELECT client_id FROM conversations
       WHERE org_id = current_setting('app.org_id')::uuid AND id = $1`,
      [conversation_id]
    );
    if (!cv.length) throw new Error('conversation not found');

    const clientId = cv[0].client_id;

    const { rows } = await client.query(
      `UPDATE clients
          SET name = COALESCE($2, name),
              birthdate = COALESCE($3, birthdate),
              notes = COALESCE($4, notes),
              tags = COALESCE($5, tags),
              updated_at = now()
        WHERE org_id = current_setting('app.org_id')::uuid
          AND id = $1
        RETURNING *`,
      [clientId, name, birthdate, notes, tags]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function createMessageRepo({ org_id, conversation_id, text, author_id = 'me', direction = 'out' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [org_id]);

    const { rows } = await client.query(
      `INSERT INTO messages (org_id, conversation_id, author_id, direction, text)
       VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4)
       RETURNING *`,
      [conversation_id, author_id, direction, text]
    );

    await client.query(
      `UPDATE conversations
         SET last_message_at = now(),
             unread_count = CASE WHEN $2 = 'in' THEN unread_count + 1 ELSE unread_count END,
             updated_at = now()
       WHERE org_id = current_setting('app.org_id')::uuid
         AND id = $1`,
      [conversation_id, direction]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

