const request = require('supertest');
import express from 'express';
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();

beforeAll(async () => {
  jest.resetModules();
  global.fetch = jest.fn((url) => {
    if (url.startsWith('https://graph.facebook.com/v19.0/oauth/access_token')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: 'user_tok' }) });
    }
    if (url.startsWith('https://graph.facebook.com/v19.0/me/accounts')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: 'pg1', name: 'Page 1', category: 'Cat', access_token: 'pg_tok' }] }) });
    }
    return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
  });
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  process.env.JWT_SECRET = 'dev-secret-change-me';
  process.env.FB_APP_ID = 'id';
  process.env.FB_APP_SECRET = 'sec';
  process.env.FB_REDIRECT_URI = 'http://localhost/cb';
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  ({ default: router } = await import('../routes/auth.facebook.js'));
  ({ default: orgRouter } = await import('../routes/orgs.facebook.js'));
});

let router;
let orgRouter;

beforeEach(() => {
  mockQuery.mockReset();
  global.fetch.mockClear();
});

function appWithRouter() {
  const app = express();
  app.use((req, _res, next) => { req.db = { query: mockQuery }; next(); });
  app.use(router);
  app.use(orgRouter);
  return app;
}

test('/start with limit=0 returns 403', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 0 }] };
    if (sql.includes('COUNT(*)') && sql.includes('facebook_pages')) return { rows: [{ used: 0 }] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter())
    .get('/api/auth/facebook/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('feature_disabled');
});

test('/start blocks when used >= limit', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('facebook_pages')) return { rows: [{ used: 1 }] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter())
    .get('/api/auth/facebook/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('feature_limit_reached');
});

test('/callback stores page and token', async () => {
  const store = { pages: [] };
  mockQuery.mockImplementation((sql, params) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('facebook_pages')) return { rows: [{ used: 0 }] };
    if (sql.startsWith('INSERT INTO facebook_pages')) {
      store.pages.push({ id: 'p1', org_id: params[0], page_id: params[1], name: params[2], category: params[3], is_active: true });
      return { rows: [{ id: 'p1' }] };
    }
    if (sql.startsWith('INSERT INTO facebook_oauth_tokens')) return { rows: [] };
    if (sql.includes('SELECT id, page_id')) return { rows: store.pages.map(p => ({ id: p.id, page_id: p.page_id, name: p.name, category: p.category, is_active: p.is_active })) };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const app = appWithRouter();
  const startRes = await request(app)
    .get('/api/auth/facebook/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  const state = new URL(startRes.headers.location).searchParams.get('state');
  const cbRes = await request(app)
    .get('/api/auth/facebook/callback')
    .query({ state, code: 'abc' });
  expect(cbRes.statusCode).toBe(302);
  expect(cbRes.headers.location).toBe('/settings?fb_connected=1');
  const listRes = await request(app).get('/api/orgs/org1/facebook/pages');
  expect(listRes.statusCode).toBe(200);
  expect(listRes.body[0].page_id).toBe('pg1');
});
