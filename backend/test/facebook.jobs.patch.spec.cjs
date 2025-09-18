/**
 * Este teste importa módulos ESM via `await import(...)`.
 * Rode com: NODE_OPTIONS=--experimental-vm-modules (já embutido no script npm).
 */
if (!process.execArgv.join(' ').includes('--experimental-vm-modules')) {
  // Não falha o teste, só loga um aviso útil
  // eslint-disable-next-line no-console
  console.warn('[WARN] Execute backend tests com NODE_OPTIONS=--experimental-vm-modules (use npm run test:backend).');
}

const request = require('supertest');
const express = require('express');
let router;
const jobs = { job1:{ id:'job1', org_id:'o1', status:'pending', scheduled_at:'2024-01-01T00:00:00Z' } };
const mockQuery = jest.fn((sql, params) => {
  if (sql.startsWith('SELECT 1 FROM facebook_publish_jobs')) return { rowCount: jobs[params[1]] && jobs[params[1]].org_id===params[0] ? 1 : 0 };
  if (sql.startsWith('SELECT id, page_id')) return { rows:[{ id:'job1', page_id:'pg1', type:'text', status:jobs['job1'].status, scheduled_at:jobs['job1'].scheduled_at, updated_at:jobs['job1'].updated_at, published_post_id:null, error:null }] };
  if (sql.startsWith('SELECT status FROM facebook_publish_jobs')) return { rows:[{ status: jobs[params[1]].status }] };
  if (sql.startsWith("UPDATE facebook_publish_jobs SET status='canceled'")) { jobs[params[1]].status='canceled'; jobs[params[1]].updated_at = 'now'; return { rows:[] }; }
  if (sql.startsWith('UPDATE facebook_publish_jobs SET scheduled_at')) { jobs[params[1]].scheduled_at=params[2]; jobs[params[1]].updated_at='now'; return { rows:[] }; }
  if (sql.startsWith('SELECT id, status, scheduled_at, updated_at FROM facebook_publish_jobs')) {
    const j = jobs[params[1]]; return { rows:[{ id:j.id, status:j.status, scheduled_at:j.scheduled_at, updated_at:j.updated_at }] };
  }
  return { rows:[] };
});

beforeAll(async () => {
  jest.resetModules();
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  ({ default: router } = await import('../routes/orgs.facebook.jobs.js'));
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('cancel pending job', async () => {
  const res = await request(app()).patch('/api/orgs/o1/facebook/jobs/job1').send({ status:'canceled' });
  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('canceled');
});

test('reschedule pending job', async () => {
  jobs.job1.status = 'pending';
  const iso = new Date(Date.now()+1000).toISOString();
  const res = await request(app()).patch('/api/orgs/o1/facebook/jobs/job1').send({ scheduled_at: iso });
  expect(res.statusCode).toBe(200);
  expect(res.body.scheduled_at).toBe(iso);
});

test('patch non-pending returns 409', async () => {
  jobs.job1.status = 'done';
  const res = await request(app()).patch('/api/orgs/o1/facebook/jobs/job1').send({ status:'canceled' });
  expect(res.statusCode).toBe(409);
});
