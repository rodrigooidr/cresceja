const request = require('supertest');
import express from 'express';
let router;
let encrypt;

beforeAll(async () => {
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  ({ default: router } = await import('../routes/orgs.facebook.js'));
  ({ encrypt } = await import('../services/crypto.js'));
});

test('invalid token causes reauth_required and deactivates', async () => {
  const enc = encrypt('bad');
  let updateCalled = false;
  const db = {
    query: jest.fn((sql) => {
      if (sql.startsWith('SELECT p.page_id')) {
        return Promise.resolve({ rows: [{ page_id: 'pg1', access_token: enc.c, enc_ver: enc.v }] });
      }
      if (sql.startsWith('UPDATE facebook_pages SET is_active=false')) {
        updateCalled = true;
        return Promise.resolve({});
      }
      return Promise.resolve({ rows: [] });
    })
  };
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) });
  const app = express();
  app.use((req, _res, next) => { req.db = db; next(); });
  app.use(router);
  const res = await request(app).get('/api/orgs/o1/facebook/pages/p1/posts');
  expect(res.statusCode).toBe(409);
  expect(res.body.error).toBe('reauth_required');
  expect(updateCalled).toBe(true);
});
