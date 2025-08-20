import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pg from 'pg';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const worker = new Worker(
  'social:publish',
  async (job) => {
    const { channel, to, message } = job.data;
    if (!channel) return { ok: false, reason: 'no_channel' };
    if (channel.type === 'whatsapp_cloud') {
      const token = channel.secrets?.token;
      const phoneId = channel.secrets?.phone_number_id;
      if (token && phoneId) {
        await axios.post(
          `https://graph.facebook.com/v17.0/${phoneId}/messages`,
          { messaging_product: 'whatsapp', to, text: { body: message } },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      return { ok: true };
    }
    if (channel.type === 'whatsapp_baileys') {
      const { state } = await useMultiFileAuthState(`baileys_${channel.id}`);
      const sock = makeWASocket({ auth: state });
      await sock.sendMessage(to, { text: message });
      return { ok: true };
    }
    // Stub for instagram/facebook
    console.log('Stub publish', channel.type, to, message);
    return { ok: true };
  },
  { connection }
);

worker.on('failed', (job, err) => console.error('social:publish failed', job?.id, err));
worker.on('completed', (job) => console.log('social:publish done', job.id));

console.log('social.worker online');

async function processScheduledPosts() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT ce.id, ce.post_id, p.channels
         FROM calendar_events ce
         JOIN posts p ON p.id = ce.post_id
        WHERE ce.scheduled_at <= NOW()
          AND ce.status = 'scheduled'
        LIMIT 10`
    );
    for (const ev of rows) {
      try {
        console.log('Auto publish stub', ev.post_id, ev.channels);
        await client.query('UPDATE calendar_events SET status = $1 WHERE id = $2', [
          'published',
          ev.id,
        ]);
        await client.query('UPDATE posts SET status = $1 WHERE id = $2', [
          'published',
          ev.post_id,
        ]);
      } catch (err) {
        await client.query('UPDATE calendar_events SET status = $1 WHERE id = $2', [
          'failed',
          ev.id,
        ]);
        await client.query('UPDATE posts SET status = $1 WHERE id = $2', [
          'failed',
          ev.post_id,
        ]);
      }
    }
  } finally {
    client.release();
  }
}

setInterval(processScheduledPosts, 10000);
