// backend/services/ai/autoResponder.js
import { query as rootQuery } from '#db';
import pkg from 'bullmq';
const { Queue } = pkg;
import IORedis from 'ioredis';
import { logTelemetry } from '../telemetryService.js';
import * as schedulerBot from './scheduler.bot.js';
import { ensureToken } from '../calendar/rsvp.js';

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

function getRedis() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

async function enqueueSystemMessage({ db, orgId, conversationId, text, queue = null }) {
  if (!text) return null;
  const ins = await q(db)(
    `INSERT INTO messages (org_id, conversation_id, sender, direction, type, text, provider, status, created_at)
       VALUES ($1, $2, 'agent', 'outbound', 'text', $3, 'whatsapp_cloud', 'queued', NOW())
     RETURNING id`,
    [orgId, conversationId, text]
  );
  const messageId = ins.rows?.[0]?.id;
  if (!messageId) return null;
  const queueInstance = queue || new Queue('social-publish', { connection: getRedis() });
  await queueInstance.add(
    'send',
    { orgId, conversationId, messageId },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
  return messageId;
}

export async function autoReplyIfEnabled({ db, orgId, conversationId, contactId, text }) {
  const normalizedText = (text || '').trim().toLowerCase();

  if (normalizedText === 'confirmar' && contactId) {
    try {
      const fromISO = new Date().toISOString();
      const toISO = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const baseUrl = `http://127.0.0.1:${process.env.PORT || 4000}`;
      const eventsUrl = new URL('/api/calendar/events', baseUrl);
      eventsUrl.searchParams.set('contactId', contactId);
      eventsUrl.searchParams.set('from', fromISO);
      eventsUrl.searchParams.set('to', toISO);
      const resp = await fetch(eventsUrl.toString());
      if (resp.ok) {
        const js = await resp.json();
        const next = (js.items || [])[0];
        if (next?.id) {
          const token = next.rsvp_token || (await ensureToken(next.id));
          if (!token) return;
          await fetch(`${baseUrl}/api/calendar/rsvp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, action: 'confirm' }),
          });
          if (conversationId) {
            await fetch(`${baseUrl}/api/inbox/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                text: 'Presença confirmada. Obrigado!',
                meta: { system: true, type: 'calendar.rsvp', status: 'confirmed' },
              }),
            }).catch(() => {});
          }
          return;
        }
      }
    } catch (_err) {
      // silencioso
    }
  }

  const { rows } = await q(db)(
    'SELECT enabled, handoff_keywords FROM org_ai_settings WHERE org_id = $1',
    [orgId]
  );
  const s = rows[0];
  if (!s?.enabled) return;

  const kws = s.handoff_keywords || [];
  const lower = normalizedText;

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

  try {
    const maybe = await schedulerBot.handleIncoming({
      orgId,
      conversationId,
      text,
      contact: contactId ? { id: contactId } : null,
    });

    if (maybe?.handled) {
      const queue = new Queue('social-publish', { connection: getRedis() });
      for (const message of maybe.messages || []) {
        if (message.type === 'text') {
          await enqueueSystemMessage({ db, orgId, conversationId, text: message.text, queue });
        } else if (message.type === 'options') {
          await enqueueSystemMessage({
            db,
            orgId,
            conversationId,
            text: `Opções: ${(message.options || []).join(' | ')}`,
            queue,
          });
        }
      }
      return;
    }
  } catch (e) {
    // fallback silencioso
  }

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
