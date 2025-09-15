// backend/services/inbox/repo.db.js
// Adapted to use the project's pg wrapper (imported via #db alias)
import db from '#db';

function parseAccessTokenEnc(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function encodeAccessTokenEnc(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return null; }
}

function mapRow(row) {
  if (!row) return row;
  const perms = Array.isArray(row.permissions_json)
    ? row.permissions_json
    : typeof row.permissions_json === 'string'
      ? (() => { try { return JSON.parse(row.permissions_json); } catch { return []; } })()
      : [];
  return {
    ...row,
    permissions_json: perms,
    access_token_enc: parseAccessTokenEnc(row.access_token_enc),
  };
}

function buildWhere(base, filters) {
  const conds = [];
  const args = [];
  let idx = 1;
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    conds.push(`${k} = $${idx++}`);
    args.push(v);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { sql: `${base} ${where}`, args };
}

export function makeDbRepo() {
  return {
    _db: db,
    // ---- channel_accounts ----
    async findChannelAccountByExternal({ channel, externalAccountId }) {
      const { rows } = await db.query(
        `SELECT * FROM channel_accounts WHERE channel = $1 AND external_account_id = $2 LIMIT 1`,
        [channel, externalAccountId]
      );
      return rows[0] || null;
    },
    async seedChannelAccount(row) {
      const { rows } = await db.query(
        `INSERT INTO channel_accounts (org_id, channel, external_account_id, name, username, access_token_enc, token_expires_at, webhook_subscribed, permissions_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,false),COALESCE($9::jsonb,'[]'::jsonb))
         ON CONFLICT (org_id, channel, external_account_id)
         DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, access_token_enc = EXCLUDED.access_token_enc,
                       token_expires_at = EXCLUDED.token_expires_at, webhook_subscribed = EXCLUDED.webhook_subscribed,
                       permissions_json = EXCLUDED.permissions_json
         RETURNING *`,
        [
          row.org_id, row.channel, row.external_account_id, row.name || null, row.username || null,
          encodeAccessTokenEnc(row.access_token_enc) || null,
          row.token_expires_at || null,
          row.webhook_subscribed || false,
          JSON.stringify(row.permissions_json || []),
        ]
      );
      return mapRow(rows[0]);
    },
    async listChannelAccounts({ org_id, channel } = {}) {
      const { rows } = await db.query(
        `SELECT * FROM channel_accounts WHERE org_id = $1 AND ($2::text IS NULL OR channel = $2) ORDER BY created_at DESC`,
        [org_id, channel || null]
      );
      return rows.map(mapRow);
    },
    async getChannelAccountById(id) {
      const { rows } = await db.query(
        `SELECT * FROM channel_accounts WHERE id = $1`,
        [id]
      );
      return mapRow(rows[0]) || null;
    },
    async setChannelAccountSubscribed(id, subscribed = true) {
      const { rows } = await db.query(
        `UPDATE channel_accounts SET webhook_subscribed = $2 WHERE id = $1 RETURNING *`,
        [id, subscribed]
      );
      return mapRow(rows[0]) || null;
    },
    async markAccountSubscribed(id) {
      const { rows } = await db.query(
        `UPDATE channel_accounts SET webhook_subscribed = TRUE WHERE id = $1 RETURNING *`,
        [id]
      );
      return mapRow(rows[0]) || null;
    },
    async deleteChannelAccount(id) {
      await db.query(`DELETE FROM channel_accounts WHERE id = $1`, [id]);
    },

    // ---- contacts / identities ----
    async findContactIdByIdentity({ org_id, channel, account_id, identity }) {
      const { rows } = await db.query(
        `SELECT contact_id FROM contact_identities WHERE org_id = $1 AND channel = $2 AND account_id = $3 AND identity = $4 LIMIT 1`,
        [org_id, channel, account_id, identity]
      );
      return rows[0]?.contact_id || null;
    },
    async createContactWithIdentity({ org_id, name = '—', channel, account_id, identity }) {
      // transaction
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const { rows: cRows } = await client.query(
          `INSERT INTO contacts (org_id, name) VALUES ($1,$2) RETURNING *`,
          [org_id, name]
        );
        const contact = cRows[0];
        await client.query(
          `INSERT INTO contact_identities (org_id, channel, account_id, identity, contact_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (org_id, channel, account_id, identity) DO NOTHING`,
          [org_id, channel, account_id, identity, contact.id]
        );
        await client.query('COMMIT');
        return contact;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },

    // ---- conversations ----
    async findConversation({ org_id, channel, account_id, external_user_id }) {
      const { rows } = await db.query(
        `SELECT * FROM conversations WHERE org_id=$1 AND channel=$2 AND account_id=$3 AND external_user_id=$4 LIMIT 1`,
        [org_id, channel, account_id, external_user_id]
      );
      return rows[0] || null;
    },
    async getConversationById(id, org_id) {
      const { rows } = await db.query(
        `SELECT * FROM conversations WHERE id = $1 AND ($2::text IS NULL OR org_id::text = $2)`,
        [id, org_id || null]
      );
      return rows[0] || null;
    },
    async createConversation(row) {
      const { rows } = await db.query(
        `INSERT INTO conversations (org_id, channel, account_id, external_user_id, external_thread_id, contact_id, last_message_at, unread_count, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,0),COALESCE($9,'open'))
         RETURNING *`,
        [
          row.org_id, row.channel, row.account_id, row.external_user_id, row.external_thread_id || null,
          row.contact_id, row.last_message_at, row.unread_count || 0, row.status || 'open'
        ]
      );
      return rows[0];
    },
    async updateConversation(id, patch) {
      const fields = [];
      const args = [];
      let i = 1;
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = $${i++}`);
        args.push(v);
      }
      args.push(id);
      const { rows } = await db.query(
        `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        args
      );
      return rows[0] || null;
    },

    // ---- messages ----
    async findMessageByExternalId({ org_id, external_message_id }) {
      const { rows } = await db.query(
        `SELECT * FROM messages WHERE org_id=$1 AND external_message_id=$2 LIMIT 1`,
        [org_id, external_message_id]
      );
      return rows[0] || null;
    },
    async createMessage(row) {
      const { rows } = await db.query(
        `INSERT INTO messages (org_id, conversation_id, external_message_id, direction, text, attachments_json, sent_at, raw_json)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'[]'::jsonb),$7,$8)
         ON CONFLICT (org_id, external_message_id) DO NOTHING
         RETURNING *`,
        [
          row.org_id, row.conversation_id, row.external_message_id, row.direction,
          row.text || null, JSON.stringify(row.attachments_json || []), row.sent_at, row.raw_json || {}
        ]
      );
      return rows[0] || null;
    },
    async updateMessageAttachments(id, attachments) {
      const { rows } = await db.query(
        `UPDATE messages SET attachments_json = COALESCE($2::jsonb, '[]'::jsonb) WHERE id = $1 RETURNING *`,
        [id, JSON.stringify(attachments || [])]
      );
      return rows[0] || null;
    },
    async getMessageById(id) {
      const { rows } = await db.query(
        `SELECT * FROM messages WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    },
    async getLastIncomingAt(conversation_id) {
      const { rows } = await db.query(
        `SELECT sent_at FROM messages WHERE conversation_id = $1 AND direction = 'in' ORDER BY sent_at DESC LIMIT 1`,
        [conversation_id]
      );
      return rows[0]?.sent_at || null;
    },
    async appendOutgoingMessage({ org_id, conversation_id, text, raw_json }) {
      const { rows } = await db.query(
        `INSERT INTO messages (org_id, conversation_id, external_message_id, direction, text, attachments_json, sent_at, raw_json)
         VALUES ($1,$2,$3,'out',$4,'[]'::jsonb,NOW(),$5)
         RETURNING *`,
        [org_id, conversation_id, `local_${Date.now()}`, text, raw_json || {}]
      );
      await db.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversation_id]);
      return rows[0] || null;
    },

    // ---- queries p/ endpoints ----
    async listConversations({ org_id, channel, account_id, limit = 50, offset = 0 }) {
      const filters = { org_id, channel, account_id };
      const base = `SELECT * FROM conversations`;
      const { sql, args } = buildWhere(base, filters);
      const { rows } = await db.query(
        `${sql} ORDER BY last_message_at DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, limit, offset]
      );
      const { rows: countRows } = await db.query(`SELECT COUNT(1) AS c FROM conversations ${sql.slice(base.length)}`, args);
      return { items: rows.map(mapRow), total: Number(countRows[0].c) };
    },
    async listMessages({ conversation_id, limit = 50, offset = 0 }) {
      const { rows } = await db.query(
        `SELECT * FROM messages WHERE conversation_id=$1 ORDER BY sent_at ASC LIMIT $2 OFFSET $3`,
        [conversation_id, limit, offset]
      );
      const { rows: countRows } = await db.query(
        `SELECT COUNT(1) AS c FROM messages WHERE conversation_id=$1`,
        [conversation_id]
      );
      return { items: rows.map(mapRow), total: Number(countRows[0].c) };
    },
  };
}

export async function upsertMessage({ orgId, platform, threadId, externalMessageId, payload }) {
  const sql = `
    INSERT INTO messages (org_id, platform, thread_id, external_message_id)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (platform, thread_id, external_message_id)
    DO UPDATE SET org_id = EXCLUDED.org_id
    RETURNING id, org_id
  `;
  const { rows } = await db.query(sql, [orgId, platform, threadId, externalMessageId]);
  return rows[0];
}

export async function upsertAttachmentByIdx({
  orgId, messageId, idx,
  fileName, mime, sizeBytes, width, height, durationMs,
  checksumSha256, storageProvider, pathOrKey, thumbnailKey, posterKey
}) {
  const sql = `
    INSERT INTO message_attachments (
      org_id, message_id, idx, file_name, mime, size_bytes, width, height, duration_ms,
      checksum_sha256, storage_provider, path_or_key, thumbnail_key, poster_key
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    ON CONFLICT (message_id, idx)
    DO UPDATE SET
      file_name = EXCLUDED.file_name,
      mime = EXCLUDED.mime,
      size_bytes = EXCLUDED.size_bytes,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      duration_ms = EXCLUDED.duration_ms,
      checksum_sha256 = EXCLUDED.checksum_sha256,
      storage_provider = EXCLUDED.storage_provider,
      path_or_key = EXCLUDED.path_or_key,
      thumbnail_key = EXCLUDED.thumbnail_key,
      poster_key = EXCLUDED.poster_key
    RETURNING id
  `;
  const params = [
    orgId, messageId, idx,
    fileName, mime, sizeBytes, width, height, durationMs,
    checksumSha256, storageProvider, pathOrKey, thumbnailKey, posterKey
  ];
  const { rows } = await db.query(sql, params);
  return rows[0];
}

export async function getAttachmentByMessageIdx(messageId, idx) {
  const { rows } = await db.query(
    `SELECT * FROM message_attachments WHERE message_id=$1 AND idx=$2`,
    [messageId, idx]
  );
  return rows[0] || null;
}

export async function getMessageOrg(messageId) {
  const { rows } = await db.query(`SELECT org_id FROM messages WHERE id=$1`, [messageId]);
  return rows[0]?.org_id || null;
}

export async function userHasAccessToOrg(userId, orgId) {
  const { rows } = await db.query(
    `SELECT 1 FROM user_orgs WHERE user_id=$1 AND org_id=$2 LIMIT 1`,
    [userId, orgId]
  );
  return !!rows[0];
}

export default { makeDbRepo };
