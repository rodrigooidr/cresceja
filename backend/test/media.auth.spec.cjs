const express = require('express');
const request = require('supertest');

let app;
let repoMocks;

beforeAll(async () => {
  repoMocks = {
    getMessageOrg: jest.fn(async (id) => (id === 'known' ? 'org-1' : null)),
    userHasAccessToOrg: jest.fn(async (userId, orgId) => userId === 'u-1' && orgId === 'org-1'),
    getAttachmentByMessageIdx: jest.fn(async (msgId, idx) =>
      msgId === 'known' && idx === 0
        ? { storage_provider: 'local', path_or_key: 'blobs/dummy.bin' }
        : null
    ),
  };

  await jest.unstable_mockModule('../services/inbox/repo.js', () => ({
    __esModule: true,
    ...repoMocks,
  }));

  const { default: mediaRouter } = await import('../routes/media.js');
  app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'u-1' };
    next();
  });
  app.use(mediaRouter);
});

afterEach(() => {
  Object.values(repoMocks).forEach((fn) => fn.mockClear());
});

describe('GET /api/media/:messageId/:index', () => {
  it('400 para index inválido', async () => {
    const r = await request(app)
      .get('/api/media/known/NaN')
      .set('X-Org-Id', 'org-1');
    expect(r.status).toBe(400);
  });

  it('401 sem auth header org', async () => {
    const r = await request(app)
      .get('/api/media/known/0');
    expect(r.status).toBe(401);
  });

  it('404 quando mensagem não existe', async () => {
    const r = await request(app)
      .get('/api/media/unknown/0')
      .set('X-Org-Id', 'org-1');
    expect(r.status).toBe(404);
  });
});
