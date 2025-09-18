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

const initial = [
  { id:'j1', org_id:'o1', status:'pending', scheduled_at:new Date().toISOString() },
  { id:'j2', org_id:'o1', status:'done', scheduled_at:new Date().toISOString() }
];
let jobs = [];

const mockQuery = jest.fn((sql, params) => {
  if (sql.startsWith('SELECT 1 FROM instagram_publish_jobs')) {
    const job = jobs.find(j=>j.id===params[1] && j.org_id===params[0]);
    return { rowCount: job?1:0 };
  }
  if (sql.startsWith('SELECT status FROM instagram_publish_jobs')) {
    const job = jobs.find(j=>j.id===params[1]);
    return { rows:[{ status: job.status }] };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='canceled'")) {
    const job = jobs.find(j=>j.id===params[1]);
    job.status='canceled';
    job.updated_at='now';
    return { rows:[] };
  }
  if (sql.startsWith('UPDATE instagram_publish_jobs SET scheduled_at')) {
    const job = jobs.find(j=>j.id===params[1]);
    job.scheduled_at=params[2];
    job.updated_at='now';
    return { rows:[] };
  }
  if (sql.startsWith('SELECT id, status, scheduled_at, updated_at FROM instagram_publish_jobs')) {
    const job = jobs.find(j=>j.id===params[1]);
    return { rows:[job] };
  }
  return { rows:[] };
});

let router;

beforeAll(async () => {
  jest.mock('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  ({ default: router } = await import('../routes/orgs.instagram.jobs.js'));
});

beforeEach(() => {
  jobs = JSON.parse(JSON.stringify(initial));
  mockQuery.mockClear();
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.db={ query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('cancel pending job', async () => {
  const res = await request(app()).patch('/api/orgs/o1/instagram/jobs/j1').send({ status:'canceled' });
  expect(res.statusCode).toBe(200);
  expect(jobs[0].status).toBe('canceled');
});

test('reschedule pending job', async () => {
  const newDate = new Date(Date.now()+3600_000).toISOString();
  const res = await request(app()).patch('/api/orgs/o1/instagram/jobs/j1').send({ scheduled_at:newDate });
  expect(res.statusCode).toBe(200);
  expect(jobs[0].scheduled_at).toBe(newDate);
});

test('patch non pending returns 409', async () => {
  const res = await request(app()).patch('/api/orgs/o1/instagram/jobs/j2').send({ status:'canceled' });
  expect(res.statusCode).toBe(409);
  expect(res.body.error).toBe('job_not_pending');
});
