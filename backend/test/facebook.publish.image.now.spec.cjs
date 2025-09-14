const request = require('supertest');
const express = require('express');
let router;
let encrypt;
const listJobs = [];
let tokenEnc;
const mockQuery = jest.fn((sql, params) => {
  if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
  if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:10 }] };
  if (sql.includes('FROM facebook_publish_jobs') && sql.includes("status='done'")) return { rows:[{ used:0 }] };
  if (sql.startsWith('SELECT 1 FROM facebook_pages')) return { rowCount: params[1]==='pg1' ? 1 : 0 };
  if (sql.startsWith('SELECT p.page_id as fb_page_id')) return { rows:[{ fb_page_id:'fbid', access_token: tokenEnc.c, enc_ver: tokenEnc.v }] };
  if (sql.startsWith('INSERT INTO facebook_publish_jobs')) {
    const status = sql.includes('pending') ? 'pending' : 'creating';
    const job = { id:'job'+(listJobs.length+1), status };
    listJobs.push(job);
    return { rows:[{ id: job.id, status: job.status }] };
  }
  if (sql.startsWith("UPDATE facebook_publish_jobs SET status='done'")) return { rows:[] };
  return { rows:[] };
});

beforeAll(async () => {
  jest.resetModules();
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  ({ encrypt } = await import('../services/crypto.js'));
  tokenEnc = encrypt('tok');
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  ({ default: router } = await import('../routes/orgs.facebook.publish.js'));
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('publish image now returns done and saves id', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status:200, json:()=>Promise.resolve({ post_id:'pid' }) });
  const res = await request(app()).post('/api/orgs/o1/facebook/pages/pg1/publish').set('X-Org-Id','o1').send({ type:'image', media:{ url:'http://i' }, message:'hi' });
  expect(res.statusCode).toBe(200);
  expect(res.body.published_post_id).toBe('pid');
});
