const request = require('supertest');
const express = require('express');

const listJobs = [];

const mockQuery = jest.fn((sql, params) => {
  if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
  if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:10 }] };
  if (sql.includes('FROM instagram_publish_jobs') && sql.includes("status='done'")) return { rows:[{ used:0 }] };
  if (sql.startsWith('SELECT 1 FROM instagram_accounts')) return { rowCount: params[1] === 'acc1' ? 1 : 0 };
  if (sql.startsWith('SELECT ig_user_id FROM instagram_accounts')) return { rows:[{ ig_user_id:'igid' }] };
  if (sql.startsWith('INSERT INTO instagram_publish_jobs')) {
    const status = sql.includes('scheduled_at') ? 'pending' : 'creating';
    const job = { id:'job'+(listJobs.length+1), status, account_id:params[1], org_id:params[0], media: JSON.parse(params[4]), client_dedupe_key: params[params.length-1] };
    listJobs.push(job);
    return { rows:[{ id: job.id, status: job.status }] };
  }
  if (sql.startsWith('UPDATE instagram_publish_jobs j') && sql.includes('SKIP LOCKED')) {
    const rows = listJobs.filter(j=>j.status==='pending').slice(0,20).map(j=>({ ...j, ig_user_id:'igid', caption:'', media:j.media }));
    rows.forEach(j=> j.status='creating');
    return { rows };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='done'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    if(job){ job.status='done'; job.published_media_id=params[2]; }
    return { rows:[] };
  }
  return { rows:[] };
});

let router;
let worker;

beforeAll(async () => {
  jest.resetModules();
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  jest.unstable_mockModule('../services/instagramTokens.js', () => ({ refreshIfNeeded: jest.fn().mockResolvedValue({ access_token:'tok' }) }));
  global.fetch = jest.fn(() => Promise.resolve({ ok:true, json: () => Promise.resolve({ id:'mid' }) }));
  ({ default: router } = await import('../routes/orgs.instagram.publish.js'));
  ({ processPending: worker } = await import('../queues/instagram.publish.worker.js'));
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('publish now image returns done and saves id', async () => {
  const res = await request(app()).post('/api/orgs/o1/instagram/accounts/acc1/publish').set('X-Org-Id','o1').send({ type:'image', media:{ url:'http://i' } });
  expect(res.statusCode).toBe(200);
  expect(res.body.published_media_id).toBe('mid');
});

test('schedule creates pending job and worker publishes', async () => {
  listJobs.length = 0;
  await request(app()).post('/api/orgs/o1/instagram/accounts/acc1/publish').set('X-Org-Id','o1').send({ type:'image', media:{ url:'http://i' }, scheduleAt:new Date(Date.now()+1000).toISOString() });
  expect(listJobs[0].status).toBe('pending');
  await worker();
  expect(listJobs[0].status).toBe('done');
});

test('ownership check returns 404', async () => {
  const res = await request(app()).post('/api/orgs/o1/instagram/accounts/other/publish').set('X-Org-Id','o1').send({ type:'image', media:{ url:'http://i' } });
  expect(res.statusCode).toBe(404);
});
