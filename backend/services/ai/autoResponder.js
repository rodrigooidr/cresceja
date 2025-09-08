// backend/services/ai/autoResponder.js
import { query as rootQuery } from '../../config/db.js';
import pkg from 'bullmq';
const { Queue } = pkg;
import IORedis from 'ioredis';

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

function getRedis() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

export async function autoReplyIfEnabled({ db, orgId, conversationId, contactId, text }) {
  const { rows } = await q(db)(
    'SELECT enabled, handoff_keywords FROM org_ai_settings WHERE org_id = $1',
    [orgId]
  );
  const s = rows[0];
  if (!s?.enabled) return;

  const kws = s.handoff_keywords || [];
  const lower = (text || '').toLowerCase();

  if (kws.some(k => lower.includes(k))) {
    await q(db)(
      `UPDATE conversations
          SET ai_status = 'handed_off',
              is_ai_active = FALSE,
              human_requested_at = NOW(),
              alert_sent = FALSE
        WHERE id = $1 AND org_id = $2`,
      [conversationId, orgId]
    );
    return;
  }

  if (!text) return;
  const reply = `🤖 ${text}`;

  const ins = await q(db)(
    `INSERT INTO messages (org_id, conversation_id, sender, direction, type, text, provider, status, created_at)
       VALUES ($1, $2, 'agent', 'outbound', 'text', $3, 'whatsapp_cloud', 'queued', NOW())
     RETURNING id`,
    [orgId, conversationId, reply]
  );

  const messageId = ins.rows[0].id;

  const queue = new Queue('social-publish', { connection: getRedis() });
  await queue.add('send', { orgId, conversationId, messageId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}
