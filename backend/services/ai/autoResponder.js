// backend/services/ai/autoResponder.js
import { pool } from '../../config/db.js';
import { enqueueSocialSend } from '../../queues/social.queue.js';
import { io } from '../realtime.js';

export async function autoReplyIfEnabled({ orgId, conversationId, contactId, text }) {
  const ai = await pool.query(`SELECT * FROM org_ai_settings WHERE org_id=$1`, [orgId]);
  if (!ai.rows[0]?.enabled) return;

  // handoff detection
  const kws = ai.rows[0].handoff_keywords || [];
  const lower = (text||'').toLowerCase();
  if (kws.some(k => lower.includes(k))) {
    await pool.query(`
      UPDATE conversations
         SET ai_status='handed_off', is_ai_active=FALSE, human_requested_at=NOW(), alert_sent=FALSE
       WHERE id=$1 AND org_id=$2
    `, [conversationId, orgId]);
    io.to(`org:${orgId}`).emit('alert:escalation', { conversationId });
    return;
  }

  // gerar resposta automática (stub): ecoa texto
  const reply = await generateReply({ orgId, conversationId, text });
  if (!reply) return;

  // criar message out e enfileirar envio
  const { rows } = await pool.query(`
    INSERT INTO messages (org_id, conversation_id, direction, text, provider, status, created_at)
    VALUES ($1,$2,'out',$3,NULL,'queued',NOW())
    RETURNING id
  `, [orgId, conversationId, reply]);
  await enqueueSocialSend({ orgId, conversationId, messageId: rows[0].id });
}

async function generateReply({ orgId, conversationId, text }) {
  // integrar com seu LLM aqui; por enquanto, uma resposta simples
  if (!text) return null;
  return `🤖 ${text}`;
}
