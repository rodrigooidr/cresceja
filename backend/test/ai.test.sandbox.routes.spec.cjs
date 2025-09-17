/* eslint-env jest */

const request = require('supertest');
const express = require('express');

async function setupApp({
  dbQueryImpl = jest.fn().mockResolvedValue({ rows: [] }),
  getProfileImpl = jest.fn().mockResolvedValue({ orgId: 'org-1' }),
  ragResults = [{ text: 'doc', meta: {} }],
  inferResult = { output: 'OK (mock)', tokens: 123, toolCalls: [], confidence: 0.85 },
} = {}) {
  jest.resetModules();
  const dbQuery = jest.fn(dbQueryImpl);
  const getProfile = jest.fn(getProfileImpl);
  const ragSearch = jest.fn().mockResolvedValue(ragResults);
  const inferRun = jest.fn().mockResolvedValue(inferResult);

  await jest.unstable_mockModule('../services/ai/profileService.js', () => ({
    getProfile,
    updateProfile: jest.fn(),
  }));
  await jest.unstable_mockModule('../services/ai/rag.js', () => ({
    search: ragSearch,
  }));
  await jest.unstable_mockModule('../services/ai/infer.js', () => ({
    run: inferRun,
  }));

  const router = (await import('../routes/ai.test.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role: 'OrgAdmin' };
    req.db = { query: dbQuery };
    next();
  });
  app.use(router);

  return { app, getProfile, ragSearch, inferRun, dbQuery };
}

describe('AI sandbox route', () => {
  test('happy path runs search and inference', async () => {
    const { app, getProfile, ragSearch, inferRun, dbQuery } = await setupApp();

    const res = await request(app)
      .post('/api/orgs/org-1/ai/test')
      .send({
        message: 'Olá',
        useDraft: true,
        profile: {
          vertical: 'health',
          rag: { topK: 2 },
          guardrails: { maxReplyChars: 200 },
        },
      })
      .expect(200);

    expect(getProfile).not.toHaveBeenCalled();
    expect(ragSearch).toHaveBeenCalledWith('org-1', 'Olá', { topK: 2 });
    expect(inferRun).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.any(String) }));
    expect(res.body).toEqual(
      expect.objectContaining({
        reply: 'OK (mock)',
        debug: expect.objectContaining({ tokens: 123, toolCalls: [], contextDocs: [{ text: 'doc', meta: {} }] }),
      })
    );
    expect(dbQuery).not.toHaveBeenCalled();
  });

  test('blocks request on pre-check violation', async () => {
    const violationRows = [];
    const dbQuery = jest.fn(async (sql) => {
      if (/ai_guardrail_violations/.test(sql)) {
        violationRows.push(sql);
      }
      return { rows: [] };
    });

    const { app, inferRun, ragSearch } = await setupApp({
      dbQueryImpl: dbQuery,
      ragResults: [],
    });

    const res = await request(app)
      .post('/api/orgs/org-1/ai/test')
      .send({
        message: 'Quero price_negotiation',
        useDraft: true,
        profile: {
          guardrails: { pre: [{ type: 'blockTopic', value: 'price_negotiation' }] },
        },
      })
      .expect(200);

    expect(ragSearch).not.toHaveBeenCalled();
    expect(inferRun).not.toHaveBeenCalled();
    expect(res.body.reply).toMatch(/não posso ajudar/i);
    expect(res.body.debug.violations[0]).toMatchObject({ stage: 'pre' });
    expect(dbQuery).toHaveBeenCalled();
  });

  test('post-check violation replaces reply', async () => {
    const dbQuery = jest.fn(async () => ({ rows: [] }));
    const { app, inferRun } = await setupApp({ dbQueryImpl: dbQuery });

    const res = await request(app)
      .post('/api/orgs/org-1/ai/test')
      .send({
        message: 'Olá',
        useDraft: true,
        profile: {
          guardrails: { maxReplyChars: 2 },
        },
      })
      .expect(200);

    expect(inferRun).toHaveBeenCalled();
    expect(res.body.reply).toMatch(/não posso responder/i);
    expect(res.body.debug.violations[0]).toMatchObject({ stage: 'post' });
    expect(dbQuery).toHaveBeenCalled();
  });
});
