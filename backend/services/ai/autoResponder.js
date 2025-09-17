// backend/services/ai/autoResponder.js
import { query as rootQuery } from '#db';
import pkg from 'bullmq';
const { Queue } = pkg;
import IORedis from 'ioredis';
import { logTelemetry } from '../telemetryService.js';

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
    const autoDisable =
      process.env.HANDOFF_AUTO_DISABLE_IA === undefined ||
      ['true', '1', 'yes'].includes(String(process.env.HANDOFF_AUTO_DISABLE_IA).toLowerCase());

    await q(db)(
      `UPDATE conversations
          SET human_requested_at = COALESCE(human_requested_at, NOW()),
              alert_sent = FALSE,
              ai_enabled = CASE WHEN $3 THEN FALSE ELSE ai_enabled END
        WHERE id = $1 AND org_id = $2`,
      [conversationId, orgId, autoDisable]
    );

    await logTelemetry(db, {
      orgId,
      userId: null,
      source: 'handoff',
      eventKey: 'handoff.requested',
      metadata: { trigger: 'client_keyword', contactId },
    });
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

  await logTelemetry(db, {
    orgId,
    userId: null,
    source: 'ai',
    eventKey: 'ai.autoreply.sent',
    metadata: { conversationId, contactId },
  });

  const queue = new Queue('social-publish', { connection: getRedis() });
  await queue.add('send', { orgId, conversationId, messageId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}
