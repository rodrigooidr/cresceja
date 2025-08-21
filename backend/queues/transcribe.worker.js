// backend/queues/transcribe.worker.js
import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { pool } from '../config/db.js';

async function transcribe({ orgId, messageId }) {
  // obter attachment do tipo 'audio' -> baixar arquivo -> transcrever (stub)
  const { rows } = await pool.query(`
    SELECT ma.asset_id FROM message_attachments ma
     JOIN messages m ON m.id=ma.message_id AND m.org_id=ma.org_id
    WHERE ma.kind='audio' AND ma.message_id=$1 AND ma.org_id=$2
    LIMIT 1
  `, [messageId, orgId]);
  if (!rows[0]) return;

  const text = '[transcricao simulada]'; // integrar Whisper/OpenAI aqui
  await pool.query(`
    INSERT INTO message_transcripts (org_id, message_id, provider, language, text)
    VALUES ($1,$2,'whisper','pt-BR',$3)
  `, [orgId, messageId, text]);
}

new Worker('content:transcribe', async job => { await transcribe(job.data); }, { connection: getRedis() });
console.log('[transcribe.worker] online');
