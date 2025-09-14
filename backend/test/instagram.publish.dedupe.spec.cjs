const request = require('supertest');
const express = require('express');

const listJobs = [];

const mockQuery = jest.fn((sql, params) => {
  if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
  if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:10 }] };
  if (sql.includes('FROM instagram_publish_jobs') && sql.includes("status='done'")) return { rows:[{ used:0 }] };
  if (sql.startsWith('SELECT 1 FROM instagram_accounts')) return { rowCount:1 };
  if (sql.startsWith('SELECT ig_user_id FROM instagram_accounts')) return { rows:[{ ig_user_id:'igid' }] };
  if (sql.startsWith('INSERT INTO instagram_publish_jobs')) {
    const dedupe = params[params.length-1];
    const existing = listJobs.find(j=> j.client_dedupe_key===dedupe && ['pending','creating','publishing'].includes(j.status));
    if (existing) {
      const err = new Error('dup');
      err.code = '23505';
      err.constraint = 'ux_ig_jobs_dedupe';
      throw err;
    }
    const status = sql.includes('scheduled_at') ? 'pending' : 'creating';
    const job = { id:'job'+(listJobs.length+1), status, client_dedupe_key: dedupe };
    listJobs.push(job);
    return { rows:[{ id: job.id, status: job.status }] };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='done'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    if(job){ job.status='done'; }
    return { rows:[] };
  }
  return { rows:[] };
});

let router;

beforeAll(async () => {
  jest.resetModules();
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  jest.unstable_mockModule('../services/instagramTokens.js', () => ({ refreshIfNeeded: jest.fn().mockResolvedValue({ access_token:'tok' }) }));
  global.fetch = jest.fn(() => new Promise(res => setTimeout(() => res({ ok:true, json: () => Promise.resolve({ id:'mid' }) }), 10)));
  ({ default: router } = await import('../routes/orgs.instagram.publish.js'));
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('duplicate publish returns 409', async () => {
  const a = app();
  const payload = { type:'image', media:{ url:'http://i' } };
  const p1 = request(a).post('/api/orgs/o1/instagram/accounts/acc1/publish').set('X-Org-Id','o1').send(payload);
    const p2 = request(a).post('/api/orgs/o1/instagram/accounts/acc1/publish').set('X-Org-Id','o1').send(payload);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect([200,409]).toContain(r1.statusCode);
    expect([200,409]).toContain(r2.statusCode);
  const dup = r1.statusCode === 409 ? r1 : r2;
  expect(dup.statusCode).toBe(409);
  expect(dup.body.error).toBe('duplicate_job');
});
