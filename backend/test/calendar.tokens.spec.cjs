const request = require('supertest');
const express = require('express');
const { encrypt, decrypt } = require('../services/crypto.util.cjs');

jest.mock('../middleware/auth', () => ({ requireAuth: (_req,_res,next) => next() }));
jest.mock('../middleware/impersonalization', () => ({ impersonation: (_req,_res,next) => next() }));

process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';

const router = require('../routes/orgs.calendar.api.cjs');

describe('calendar token refresh and revoke', () => {
  let app, db, tokens, account;

  beforeEach(() => {
    tokens = null;
    account = { is_active: true };
    db = { query: jest.fn(async (sql, params) => {
      if (sql.startsWith('SELECT id, access_token')) return { rows: tokens ? [tokens] : [] };
      if (sql.startsWith('INSERT INTO google_oauth_tokens')) {
        tokens = { id: tokens?.id || 't1', access_token: params[1], refresh_token: params[2], expiry: params[3], scopes: params[4], enc_ver: params[5] };
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM google_oauth_tokens')) { tokens = null; return { rows: [] }; }
      if (sql.startsWith('UPDATE google_calendar_accounts SET is_active=false')) { account.is_active = false; return { rows: [] }; }
      return { rows: [] };
    }) };
    app = express();
    app.use(express.json());
    app.use((req,_res,next)=>{ req.db = db; next(); });
    app.use(router);
    global.fetch = jest.fn();
  });

  test('events refreshes expired token', async () => {
    const encA = encrypt('oldA');
    tokens = { id:'t1', access_token: encA.c, refresh_token: encrypt('ref').c, expiry: new Date(Date.now()-1000).toISOString(), scopes:null, enc_ver: encA.v };
    global.fetch.mockImplementation((url) => {
      if (url === 'https://oauth2.googleapis.com/token') return Promise.resolve({ ok: true, json: async () => ({ access_token:'newA', expires_in:3600, scope:'s' }) });
      if (String(url).includes('/events')) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const res = await request(app).get('/api/orgs/o1/calendar/accounts/a1/events').query({ calendarId:'cal1' });
    expect(res.statusCode).toBe(200);
    expect(decrypt({ c: tokens.access_token, v: tokens.enc_ver })).toBe('newA');
  });

  test('manual refresh without refresh token returns 404', async () => {
    const encA = encrypt('tok');
    tokens = { id:'t1', access_token: encA.c, refresh_token: null, expiry: new Date(Date.now()-1000).toISOString(), scopes:null, enc_ver: encA.v };
    const res = await request(app).post('/api/orgs/o1/calendar/accounts/a1/refresh');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('no_refresh');
  });

  test('revoke deletes tokens and deactivates account', async () => {
    const encA = encrypt('tok');
    tokens = { id:'t1', access_token: encA.c, refresh_token: encrypt('ref').c, expiry: null, scopes:null, enc_ver: encA.v };
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = await request(app).post('/api/orgs/o1/calendar/accounts/a1/revoke');
    expect(res.statusCode).toBe(200);
    expect(tokens).toBeNull();
    expect(account.is_active).toBe(false);
  });
});
