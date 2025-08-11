import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedis } from '../config/redis.js';
import pg from 'pg';

const { Client } = pg;

// Conexão Redis (já com maxRetriesPerRequest:null no getRedis)
const connection = getRedis();

// Concurrency opcional via env (default 2)
const CONCURRENCY = Number(process.env.REPURPOSE_CONCURRENCY || 2);

const processor = async (job) => {
  const { postId, modes = ['story', 'email', 'video'] } = job.data;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT * FROM social_posts WHERE id = $1', [postId]);
    const post = rows[0];
    if (!post) return { ok: false, reason: 'post_not_found' };

    for (const m of modes) {
      let title = post.title;
      let content = post.content;
      let channel = post.channel;

      if (m === 'story')  { channel = 'instagram_story'; content = (post.content || '').slice(0, 180); }
      if (m === 'email')  { channel = 'email_marketing'; title = `[Newsletter] ${post.title}`; }
      if (m === 'video')  { channel = 'reels_tiktok'; content = `${post.content}\n\n#video`; }

      await client.query(
        `INSERT INTO social_posts
         (company_id, title, content, media_url, channel, scheduled_at, status, created_by)
         VALUES ($1,$2,$3,$4,$5,NULL,'pendente',$6)`,
        [post.company_id || null, title, content, post.media_url || null, channel, post.created_by || null]
      );
    }

    await client.query(
      `INSERT INTO repurpose_jobs (post_id, status, result, finished_at)
       VALUES ($1,'completed','{}', NOW())
       ON CONFLICT (post_id) DO UPDATE SET status='completed', finished_at=NOW()`,
      [postId]
    );

    return { ok: true };
  } finally {
    await client.end();
  }
};

const worker = new Worker('repurpose', processor, {
  connection,
  concurrency: CONCURRENCY,
  // opcional: tentativas
  // settings: { backoffStrategies: {}, retryProcessDelay: 2000 }
});

worker.on('completed', (job) => console.log('[repurpose] completed', job.id));
worker.on('failed', (job, err) => console.error('[repurpose] failed', job?.id, err?.message));

console.log('Repurpose worker online (ESM).');

// Encerramento limpo
process.on('SIGINT', async () => { await worker.close(); process.exit(0); });
process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });