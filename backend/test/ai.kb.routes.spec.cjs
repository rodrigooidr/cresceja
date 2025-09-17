/* eslint-env jest */

const request = require('supertest');
const express = require('express');

async function setupApp({ role = 'OrgAdmin' } = {}) {
  jest.resetModules();
  const ingest = jest.fn().mockResolvedValue({ id: 'doc-1' });
  const reindex = jest.fn().mockResolvedValue({ ok: true, indexed: 1 });

  await jest.unstable_mockModule('../services/ai/ingestService.js', () => ({
    ingest,
    reindex,
  }));

  const router = (await import('../routes/ai.kb.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role };
    next();
  });
  app.use(router);

  return { app, ingest, reindex };
}

describe('AI KB routes', () => {
  test('ingest stores document', async () => {
    const { app, ingest } = await setupApp();
    await request(app)
      .post('/api/orgs/org-1/kb/ingest')
      .send({ source_type: 'upload', uri: 'https://example.com/doc', tags: ['faq'] })
      .expect(200);
    expect(ingest).toHaveBeenCalledWith('org-1', { source_type: 'upload', uri: 'https://example.com/doc', tags: ['faq'] });
  });

  test('reindex triggers rebuild', async () => {
    const { app, reindex } = await setupApp();
    await request(app).post('/api/orgs/org-1/kb/reindex').expect(200);
    expect(reindex).toHaveBeenCalledWith('org-1');
  });

  test('returns 403 for unauthorized role', async () => {
    const { app } = await setupApp({ role: 'OrgViewer' });
    await request(app).post('/api/orgs/org-1/kb/ingest').send({ source_type: 'upload' }).expect(403);
  });
});
