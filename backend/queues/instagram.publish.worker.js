import 'dotenv/config';
import { query as rootQuery } from '#db';
import { refreshIfNeeded } from '../services/instagramTokens.js';

async function processPending() {
  const { rows } = await rootQuery(
    `SELECT j.id, j.org_id, j.account_id, j.type, j.caption, j.media, a.ig_user_id
       FROM instagram_publish_jobs j
       JOIN instagram_accounts a ON a.id=j.account_id
      WHERE j.status='pending' AND (j.scheduled_at IS NULL OR j.scheduled_at <= now())
      LIMIT 10`);
  for (const job of rows) {
    try {
      const tok = await refreshIfNeeded(null, job.account_id, job.org_id);
      if (!tok) throw new Error('no_token');
      const media = job.media;
      const params = new URLSearchParams({ access_token: tok.access_token, caption: job.caption || '' });
      if (job.type === 'image' || job.type === 'video') params.set(job.type === 'image' ? 'image_url' : 'video_url', media.url);
      const r1 = await fetch(`https://graph.facebook.com/v20.0/${job.ig_user_id}/media`, { method: 'POST', body: params });
      if (r1.status === 401) throw new Error('unauthorized');
      const data1 = await r1.json();
      const creationId = data1.id;
      const r2 = await fetch(`https://graph.facebook.com/v20.0/${job.ig_user_id}/media_publish?creation_id=${creationId}&access_token=${tok.access_token}`, { method: 'POST' });
      if (r2.status === 401) throw new Error('unauthorized');
      const data2 = await r2.json();
      await rootQuery(`UPDATE instagram_publish_jobs SET status='done', creation_id=$2, published_media_id=$3, updated_at=now() WHERE id=$1`, [job.id, creationId, data2.id]);
    } catch (e) {
      const err = e.message || 'error';
      await rootQuery(`UPDATE instagram_publish_jobs SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [job.id, err]);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setInterval(processPending, 60_000);
  console.log('[instagram.publish.worker] online');
}

export { processPending };
