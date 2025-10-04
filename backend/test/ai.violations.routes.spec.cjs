/* eslint-env jest */

const request = require('supertest');
import express from 'express';

async function setupApp({ role = 'OrgAdmin' } = {}) {
  jest.resetModules();
  const query = jest.fn(async () => ({
    rows: [
      { id: 'v1', org_id: 'org-1', stage: 'pre', rule: 'block', payload: { reason: 'price' }, created_at: '2024-01-01T00:00:00.000Z' },
    ],
  }));

  await jest.unstable_mockModule('#db', () => ({ query }));
  const router = (await import('../routes/ai.violations.routes.js')).default;

  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role };
    req.db = { query };
    next();
  });
  app.use(router);

  return { app, query };
}

describe('AI violations routes', () => {
  test('lists violations with limit', async () => {
    const { app, query } = await setupApp();
    const res = await request(app).get('/api/orgs/org-1/ai/violations?limit=5').expect(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM ai_guardrail_violations'),
      ['org-1', 5]
    );
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: 'v1', stage: 'pre' });
  });

  test('rejects unauthorized role', async () => {
    const { app } = await setupApp({ role: 'OrgViewer' });
    await request(app).get('/api/orgs/org-1/ai/violations').expect(403);
  });
});
