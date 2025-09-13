const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();

beforeAll(async () => {
  jest.resetModules();
  global.fetch = jest.fn((url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 's1 s2' }) });
    }
    if (String(url).includes('googleapis.com/oauth2/v2/userinfo')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'gid', email: 'e@x.com', name: 'G User' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  process.env.JWT_SECRET = 'dev-secret-change-me';
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'sec';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost/cb';
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  ({ default: router } = await import('../routes/auth.google.js'));
});

let router;

beforeEach(() => {
  mockQuery.mockReset();
  global.fetch.mockClear();
});

function appWithRouter() {
  const app = express();
  app.use((req, _res, next) => { req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

test('/start with limit=0 returns 403', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 0 }] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter())
    .get('/api/auth/google/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('feature_disabled');
});

test('/start ok redirects to google', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('google_calendar_accounts')) return { rows: [{ used: 0 }] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter())
    .get('/api/auth/google/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  expect(res.statusCode).toBe(302);
  expect(res.headers.location).toMatch(/^https:\/\/accounts.google.com/);
  const url = new URL(res.headers.location);
  expect(url.searchParams.get('state')).toBeTruthy();
});

test('/callback stores account and tokens', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('google_calendar_accounts')) return { rows: [{ used: 0 }] };
    if (sql.startsWith('INSERT INTO google_calendar_accounts')) return { rows: [{ id: 'acc1' }] };
    if (sql.startsWith('INSERT INTO google_oauth_tokens')) return { rows: [] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const app = appWithRouter();
  const startRes = await request(app)
    .get('/api/auth/google/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  const state = new URL(startRes.headers.location).searchParams.get('state');
  const cbRes = await request(app)
    .get('/api/auth/google/callback')
    .query({ state, code: 'abc' });
  expect(cbRes.statusCode).toBe(302);
  expect(cbRes.headers.location).toBe('/settings?connected=1');
  expect(mockQuery).toHaveBeenCalledWith(expect.stringMatching('INSERT INTO google_oauth_tokens'), expect.any(Array));
});

test('returnTo outside allowlist falls back to /settings', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('google_calendar_accounts')) return { rows: [{ used: 0 }] };
    if (sql.startsWith('INSERT INTO google_calendar_accounts')) return { rows: [{ id: 'acc1' }] };
    if (sql.startsWith('INSERT INTO google_oauth_tokens')) return { rows: [] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const app = appWithRouter();
  const startRes = await request(app)
    .get('/api/auth/google/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/evil' });
  const state = new URL(startRes.headers.location).searchParams.get('state');
  const cbRes = await request(app)
    .get('/api/auth/google/callback')
    .query({ state, code: 'abc' });
  expect(cbRes.statusCode).toBe(302);
  expect(cbRes.headers.location).toBe('/settings?connected=1');
});

test('reusing state returns 400', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
    if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('google_calendar_accounts')) return { rows: [{ used: 0 }] };
    if (sql.startsWith('INSERT INTO google_calendar_accounts')) return { rows: [{ id: 'acc1' }] };
    if (sql.startsWith('INSERT INTO google_oauth_tokens')) return { rows: [] };
    return { rows: [] };
  });
  const token = jwt.sign({ id: 'u1', org_id: 'org1', role: 'OrgAdmin' }, process.env.JWT_SECRET);
  const app = appWithRouter();
  const startRes = await request(app)
    .get('/api/auth/google/start')
    .set('Authorization', 'Bearer ' + token)
    .query({ orgId: 'org1', returnTo: '/settings' });
  const state = new URL(startRes.headers.location).searchParams.get('state');
  await request(app).get('/api/auth/google/callback').query({ state, code: 'abc' });
  const second = await request(app).get('/api/auth/google/callback').query({ state, code: 'abc' });
  expect(second.statusCode).toBe(400);
  expect(second.body.error).toBe('invalid_state');
});
