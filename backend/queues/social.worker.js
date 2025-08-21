// backend/queues/social.worker.js
import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { pool } from '../config/db.js';
import * as wa from '../services/social/waCloud.js';
import * as igfb from '../services/social/igfb.js';

const connection = getRedis();

async function processor(job) {
  const { orgId, conversationId, messageId } = job.data;

  // descobrir provider a partir da conversation.channel
  const { rows } = await pool.query(`
    SELECT ch.kind AS provider
      FROM conversations c
      JOIN channels ch ON ch.id=c.channel_id AND ch.org_id=c.org_id
     WHERE c.id=$1 AND c.org_id=$2
  `, [conversationId, orgId]);
  const provider = rows[0]?.provider;
  if (!provider) throw new Error('provider_not_found');

  const msg = await pool.query(`SELECT text FROM messages WHERE id=$1 AND org_id=$2`, [messageId, orgId]);
  const text = msg.rows[0]?.text || '';

  if (provider === 'whatsapp') {
    await wa.sendMessage({ orgId, conversationId, messageId, text, attachments: [] });
  } else if (provider === 'instagram' || provider === 'facebook') {
    await igfb.sendMessage({ orgId, conversationId, messageId, text });
  } else {
    throw new Error('provider_not_supported');
  }
}

new Worker('social:publish', processor, { connection });
console.log('[social.worker] online');
