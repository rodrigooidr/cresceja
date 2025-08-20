import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const publishQueue = new Queue('social:publish', { connection });

export async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const params = [req.orgId];
  let where = 'WHERE c.org_id = $1';
  if (status) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }
  const countRes = await req.db.query(
    `SELECT COUNT(*) FROM conversations c ${where}`,
    params
  );
  const total = Number(countRes.rows[0]?.count || 0);
  const listParams = [...params, limit, offset];
  const { rows } = await req.db.query(
    `SELECT c.*, ct.name AS contact_name FROM conversations c
     JOIN contacts ct ON ct.id = c.contact_id
     ${where} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );
  res.json({ data: rows, meta: { page, limit, total } });
}

export async function getMessages(req, res) {
  const { id } = req.params;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
  const offset = (page - 1) * limit;
  const countRes = await req.db.query(
    `SELECT COUNT(*) FROM messages WHERE conversation_id=$1 AND org_id=$2`,
    [id, req.orgId]
  );
  const total = Number(countRes.rows[0]?.count || 0);
  const { rows } = await req.db.query(
    `SELECT * FROM messages WHERE conversation_id=$1 AND org_id=$2 ORDER BY created_at ASC LIMIT $3 OFFSET $4`,
    [id, req.orgId, limit, offset]
  );
  res.json({ data: rows, meta: { page, limit, total } });
}

export async function sendMessage(req, res) {
  const { id } = req.params;
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content_required' });
  const convRes = await req.db.query(
    `SELECT c.*, ch.type AS channel_type, ch.secrets, ct.phone FROM conversations c
     JOIN channels ch ON ch.id = c.channel_id
     JOIN contacts ct ON ct.id = c.contact_id
     WHERE c.id=$1 AND c.org_id=$2`,
    [id, req.orgId]
  );
  const conv = convRes.rows[0];
  if (!conv) return res.status(404).json({ error: 'not_found' });
  const { rows } = await req.db.query(
    `INSERT INTO messages (org_id, conversation_id, sender, content) VALUES ($1,$2,'agent',$3) RETURNING *`,
    [req.orgId, id, content]
  );
  await publishQueue.add('send', {
    channel: { id: conv.channel_id, type: conv.channel_type, secrets: conv.secrets },
    to: conv.phone,
    message: content,
  });
  res.status(201).json({ data: rows[0] });
}

export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['open', 'pending', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  await req.db.query(
    `UPDATE conversations SET status=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
    [status, id, req.orgId]
  );
  res.json({ data: { success: true } });
}

export async function assign(req, res) {
  const { id } = req.params;
  const { userId } = req.body || {};
  await req.db.query(
    `UPDATE conversations SET assigned_to=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
    [userId, id, req.orgId]
  );
  res.json({ data: { success: true } });
}
