import 'dotenv/config';
import { query as rootQuery } from '#db';
import { decrypt } from '../services/crypto.js';

async function processPending() {
  const claimSql = `UPDATE facebook_publish_jobs j
       SET status='creating', updated_at=now()
     FROM facebook_pages p
     JOIN facebook_oauth_tokens t ON t.page_id = p.id
    WHERE j.id IN (
      SELECT id FROM facebook_publish_jobs
       WHERE status='pending' AND scheduled_at <= now()
       ORDER BY scheduled_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 20
    )
      AND p.id = j.page_id
    RETURNING j.*, p.page_id as fb_page_id, t.access_token, t.enc_ver`;
  const { rows } = await rootQuery(claimSql);
  for (const job of rows) {
    const token = decrypt({ c: job.access_token, v: job.enc_ver });
    try {
      let postId = null;
      if (job.type === 'text' || job.type === 'link') {
        const params = new URLSearchParams({ message: job.message || '', access_token: token });
        if (job.type === 'link' && job.link) params.set('link', job.link);
        const r = await fetch(`https://graph.facebook.com/v20.0/${job.fb_page_id}/feed`, { method: 'POST', body: params });
        if (r.status === 401) throw new Error('unauthorized');
        const data = await r.json();
        postId = data.id || data.post_id || null;
      } else if (job.type === 'image') {
        const media = job.media;
        const params = new URLSearchParams({ url: media.url, published: 'true', access_token: token });
        if (job.message) params.set('caption', job.message);
        const r = await fetch(`https://graph.facebook.com/v20.0/${job.fb_page_id}/photos`, { method: 'POST', body: params });
        if (r.status === 401) throw new Error('unauthorized');
        const data = await r.json();
        postId = data.post_id || data.id || null;
      } else if (job.type === 'multi_image') {
        const ids = [];
        for (const item of job.media) {
          const params = new URLSearchParams({ url: item.url, published: 'false', access_token: token });
          const r = await fetch(`https://graph.facebook.com/v20.0/${job.fb_page_id}/photos`, { method: 'POST', body: params });
          if (r.status === 401) throw new Error('unauthorized');
          const d = await r.json();
          ids.push(d.id);
        }
        const params = new URLSearchParams({ access_token: token });
        if (job.message) params.set('message', job.message);
        params.set('attached_media', JSON.stringify(ids.map(id => ({ media_fbid: id }))));
        const r2 = await fetch(`https://graph.facebook.com/v20.0/${job.fb_page_id}/feed`, { method: 'POST', body: params });
        if (r2.status === 401) throw new Error('unauthorized');
        const data2 = await r2.json();
        postId = data2.id || null;
      } else if (job.type === 'video') {
        const params = new URLSearchParams({ file_url: job.media.url, description: job.message || '', access_token: token });
        const r = await fetch(`https://graph.facebook.com/v20.0/${job.fb_page_id}/videos`, { method: 'POST', body: params });
        if (r.status === 401) throw new Error('unauthorized');
        const data = await r.json();
        const vidId = data.id;
        const delays = [2000, 4000, 8000, 16000, 30000];
        let finished = false;
        for (const d of delays) {
          const rs = await fetch(`https://graph.facebook.com/v20.0/${vidId}?fields=status&access_token=${token}`);
          if (rs.status === 401) throw new Error('unauthorized');
          const ds = await rs.json();
          if (ds.status === 'error') throw new Error('error');
          if (ds.status === 'ready' || ds.status === 'finished' || ds.status === 'published') { finished = true; break; }
          await new Promise(r => setTimeout(r, d));
        }
        if (!finished) throw new Error('timeout');
        postId = vidId;
      }
      await rootQuery(`UPDATE facebook_publish_jobs SET status='done', published_post_id=$2, updated_at=now() WHERE id=$1`, [job.id, postId]);
    } catch (e) {
      if (e.message === 'unauthorized') {
        await rootQuery('UPDATE facebook_pages SET is_active=false, updated_at=now() WHERE id=$1', [job.page_id]);
        await rootQuery(`UPDATE facebook_publish_jobs SET status='failed', error='unauthorized', updated_at=now() WHERE id=$1`, [job.id]);
      } else {
        await rootQuery(`UPDATE facebook_publish_jobs SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [job.id, e.message || 'error']);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setInterval(processPending, 60_000);
  console.log('[facebook.publish.worker] online');
}

export { processPending };
