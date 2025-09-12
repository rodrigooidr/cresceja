import { pool } from '#db';
import { enqueueSocialSend } from '../queues/social.queue.js';
import { enqueueTranscribe } from '../queues/content.queue.js';
import { uploadToAssets } from '../services/assets.js';
import { compileTemplate } from '../services/templates.js';
import { io } from '../services/realtime.js';

export async function listConversations(req, res) {
  const { page = 1, limit = 20, status, channel, q, tag } = req.query;
  const offset = (page - 1) * limit;

  const rows = await pool.query(
    `SELECT c.id, c.status, c.last_message_at, c.assigned_to, c.is_ai_active, c.ai_status,
            ct.id as contact_id, ct.display_name, ct.phone, ct.photo_asset_id,
            ch.kind as channel_kind,
            array_remove(array_agg(DISTINCT t.name), NULL) as tags
     FROM conversations c
     JOIN contacts ct ON ct.id = c.contact_id AND ct.org_id = c.org_id
     JOIN channels ch ON ch.id = c.channel_id AND ch.org_id = c.org_id
     LEFT JOIN contact_tags x ON x.contact_id = ct.id AND x.org_id = c.org_id
     LEFT JOIN tags t ON t.id = x.tag_id
     WHERE c.org_id = current_setting('app.org_id')::uuid
       AND ($1::text IS NULL OR c.status = $1)
       AND ($2::text IS NULL OR ch.kind = $2)
       AND ($3::text IS NULL OR lower(ct.display_name) LIKE '%'||lower($3)||'%' OR ct.phone LIKE '%'||$3||'%')
       AND ($4::text IS NULL OR (t.name IS NOT NULL AND lower(t.name)=lower($4)))
     GROUP BY c.id, ct.id, ch.kind
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT $5 OFFSET $6`,
    [status || null, channel || null, q || null, tag || null, limit, offset]
  );

  const { rows: totalRows } = await pool.query(
    `SELECT count(*) FROM conversations c
     JOIN contacts ct ON ct.id = c.contact_id AND ct.org_id = c.org_id
     JOIN channels ch ON ch.id = c.channel_id AND ch.org_id = c.org_id
     LEFT JOIN contact_tags x ON x.contact_id = ct.id AND x.org_id = c.org_id
     LEFT JOIN tags t ON t.id = x.tag_id
     WHERE c.org_id = current_setting('app.org_id')::uuid
       AND ($1::text IS NULL OR c.status = $1)
       AND ($2::text IS NULL OR ch.kind = $2)
       AND ($3::text IS NULL OR lower(ct.display_name) LIKE '%'||lower($3)||'%' OR ct.phone LIKE '%'||$3||'%')
       AND ($4::text IS NULL OR (t.name IS NOT NULL AND lower(t.name)=lower($4)))`,
    [status || null, channel || null, q || null, tag || null]
  );

  res.json({
    data: rows.rows,
    meta: { page: Number(page), limit: Number(limit), total: Number(totalRows[0].count) },
  });
}

export async function listMessages(req, res) {
  const { id } = req.params;
  const { before, after, limit = 50 } = req.query;
  const rows = await pool.query(
    `SELECT m.*, mt.text as transcript
     FROM messages m
     LEFT JOIN LATERAL (
       SELECT text FROM message_transcripts mt WHERE mt.message_id = m.id ORDER BY mt.id DESC LIMIT 1
     ) mt ON true
     WHERE m.org_id = current_setting('app.org_id')::uuid
       AND m.conversation_id = $1
       AND ($2::int IS NULL OR m.id < $2)
       AND ($3::int IS NULL OR m.id > $3)
     ORDER BY m.id DESC
     LIMIT $4`,
    [id, before || null, after || null, limit]
  );
  res.json({ data: rows.rows.reverse(), meta: { page: 1, limit: Number(limit), total: rows.rows.length } });
}

export async function sendMessage(req, res) {
  const { id } = req.params;
  const { text, template_id, vars = {}, attachments = [] } = req.body;

  let finalText = text;
  if (template_id) {
    const t = await compileTemplate(req.db, template_id, vars);
    finalText = t.body;
  }

  const { rows } = await pool.query(
    `INSERT INTO messages (org_id, conversation_id, direction, sender_user_id, text, created_at)
     VALUES (current_setting('app.org_id')::uuid, $1, 'out', $2, $3, NOW())
     RETURNING id`,
    [id, req.user.sub, finalText]
  );
  const messageId = rows[0].id;

  for (const a of attachments) {
    await pool.query(
      `INSERT INTO message_attachments (org_id, message_id, asset_id, kind, name, size_bytes)
       VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4, $5)`,
      [messageId, a.asset_id, a.kind, a.name || null, a.size_bytes || null]
    );
  }

  await enqueueSocialSend({ orgId: req.orgId, conversationId: id, messageId });
  io.to(`conv:${req.orgId}:${id}`).emit('message:new', { conversationId: id, messageId });

  res.json({ ok: true, messageId });
}

export async function enableAI(req, res) {
  const { id } = req.params;
  await pool.query(
    `UPDATE conversations SET is_ai_active = TRUE, ai_status='bot' WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
    [id]
  );
  res.json({ ok: true });
}

export async function disableAI(req, res) {
  const { id } = req.params;
  await pool.query(
    `UPDATE conversations SET is_ai_active = FALSE WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
    [id]
  );
  res.json({ ok: true });
}

export async function handoffToHuman(req, res) {
  const { id } = req.params;
  await pool.query(
    `UPDATE conversations
     SET ai_status='handed_off', is_ai_active=FALSE, human_requested_at=NOW(), alert_sent=FALSE
     WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
    [id]
  );
  io.to(`org:${req.orgId}`).emit('alert:escalation', { conversationId: id });
  res.json({ ok: true });
}

export async function assignConversation(req, res) {
  const { id } = req.params;
  const { user_id } = req.body || {};
  const assignee = user_id || req.user.sub;
  await pool.query(
    `UPDATE conversations SET assigned_to=$2 WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid`,
    [id, assignee]
  );
  res.json({ ok: true });
}

export async function listTemplates(req, res) {
  const { channel } = req.query;
  const q = await pool.query(
    `SELECT * FROM message_templates
     WHERE org_id=current_setting('app.org_id')::uuid
       AND ($1::text IS NULL OR cardinality(channel_scope)=0 OR $1 = ANY (channel_scope))
     ORDER BY name`,
    [channel || null]
  );
  res.json({ data: q.rows, meta: { page: 1, limit: q.rows.length, total: q.rows.length } });
}

export async function uploadAsset(req, res) {
  const asset = await uploadToAssets(req);
  res.json({ ok: true, asset_id: asset.id });
}

export async function transcribeMessage(req, res) {
  const { messageId } = req.params;
  await enqueueTranscribe({
    conversationId: id,
    messageId: newMsg.id,
    text: newMsg.text,
  });
  res.json({ ok: true });
}
