const request = require('supertest');
import express from 'express';
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();

beforeAll(async () => {
  jest.resetModules();
  process.env.JWT_SECRET = 'dev-secret-change-me';
  process.env.IG_APP_ID = 'id';
  process.env.IG_APP_SECRET = 'sec';
  process.env.IG_REDIRECT_URI = 'http://localhost/cb';
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/oauth/access_token')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }) });
    }
    if (String(url).includes('/me?')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'igid', username: 'user', name: 'User' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  ({ default: router } = await import('../routes/auth.instagram.js'));
});

let router;

function appWithRouter() {
  const app = express();
  app.use((req,_res,next)=>{ req.db = { query: mockQuery }; next(); });
  app.use(router);
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
  global.fetch.mockClear();
});

test('/start with limit=0 returns 403', async () => {
  mockQuery.mockImplementation((sql)=>{
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
    if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:0 }] };
    if (sql.includes('COUNT(*)') && sql.includes('instagram_accounts')) return { rows:[{ used:0 }] };
    return { rows:[] };
  });
  const token = jwt.sign({ id:'u1', org_id:'o1', role:'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter()).get('/api/auth/instagram/start').set('Authorization','Bearer '+token).query({ orgId:'o1', returnTo:'/settings' });
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('feature_disabled');
});

test('/start ok redirects', async () => {
  mockQuery.mockImplementation((sql)=>{
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
    if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('instagram_accounts')) return { rows:[{ used:0 }] };
    return { rows:[] };
  });
  const token = jwt.sign({ id:'u1', org_id:'o1', role:'OrgAdmin' }, process.env.JWT_SECRET);
  const res = await request(appWithRouter()).get('/api/auth/instagram/start').set('Authorization','Bearer '+token).query({ orgId:'o1', returnTo:'/settings' });
  expect(res.statusCode).toBe(302);
  expect(res.headers.location).toMatch(/^https:\/\/www.facebook.com/);
});

test('/callback stores account and token', async () => {
  mockQuery.mockImplementation((sql)=>{
    if (sql.includes('SELECT plan_id FROM organizations')) return { rows:[{ plan_id:'p1' }] };
    if (sql.includes('FROM plan_features')) return { rows:[{ enabled:true, limit:1 }] };
    if (sql.includes('COUNT(*)') && sql.includes('instagram_accounts')) return { rows:[{ used:0 }] };
    if (sql.startsWith('INSERT INTO instagram_accounts')) return { rows:[{ id:'acc1' }] };
    if (sql.startsWith('INSERT INTO instagram_oauth_tokens')) return { rows:[] };
    return { rows:[] };
  });
  const token = jwt.sign({ id:'u1', org_id:'o1', role:'OrgAdmin' }, process.env.JWT_SECRET);
  const app = appWithRouter();
  const startRes = await request(app).get('/api/auth/instagram/start').set('Authorization','Bearer '+token).query({ orgId:'o1', returnTo:'/settings' });
  const state = new URL(startRes.headers.location).searchParams.get('state');
  const cbRes = await request(app).get('/api/auth/instagram/callback').query({ state, code:'abc' });
  expect(cbRes.statusCode).toBe(302);
  expect(cbRes.headers.location).toBe('/settings?ig_connected=1');
  expect(mockQuery).toHaveBeenCalledWith(expect.stringMatching('INSERT INTO instagram_oauth_tokens'), expect.any(Array));
});
