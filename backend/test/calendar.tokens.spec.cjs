const request = require('supertest');
const express = require('express');

const mockQuery = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        constructor() {}
        setCredentials() {}
        refreshAccessToken() {
          return Promise.resolve({ credentials: { access_token: 'newA', refresh_token: 'ref', expiry_date: Date.now() + 3600000 } });
        }
      }
    },
    calendar: () => ({
      calendarList: { list: () => Promise.resolve({ data: { items: [] } }) },
      events: { list: () => Promise.resolve({ data: { items: [] } }) }
    })
  }
}));

describe('calendar token refresh and revoke', () => {
  let router, encrypt, decrypt;
  beforeAll(async () => {
    jest.resetModules();
    process.env.CRED_SECRET = '12345678901234567890123456789012';
    jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
    ({ encrypt, decrypt } = await import('../services/crypto.js'));
    ({ default: router } = await import('../routes/orgs.calendar.js'));
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  function appWithRouter() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.db = { query: mockQuery }; next(); });
    app.use(router);
    return app;
  }

  test('refresh past expiry updates tokens', async () => {
    const encrypted = encrypt('oldA');
    const tokens = { access_token: encrypted, refresh_token: encrypt('ref'), expiry: new Date(Date.now() - 1000).toISOString() };
    mockQuery.mockImplementation((sql, params) => {
      if (sql.startsWith('SELECT t.access_token')) return { rows: [tokens] };
      if (sql.startsWith('INSERT INTO google_oauth_tokens')) {
        tokens.access_token = params[1];
        tokens.refresh_token = params[2];
        tokens.expiry = params[3];
        return { rows: [] };
      }
      return { rows: [] };
    });
    const res = await request(appWithRouter()).post('/api/orgs/o1/calendar/accounts/a1/refresh');
    expect(res.statusCode).toBe(200);
    expect(decrypt(tokens.access_token)).toBe('newA');
  });

  test('revoke removes token and deactivates account', async () => {
    const accounts = [{ id: 'a1', org_id: 'o1', is_active: true }];
    const tokens = { access_token: encrypt('old'), refresh_token: encrypt('ref'), expiry: null };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
    mockQuery.mockImplementation((sql, params) => {
      if (sql.startsWith('SELECT t.access_token')) return { rows: [tokens] };
      if (sql.startsWith('DELETE FROM google_oauth_tokens')) { tokens.removed = true; return { rows: [] }; }
      if (sql.startsWith('UPDATE google_calendar_accounts SET is_active=false')) { accounts[0].is_active = false; return { rows: [] }; }
      return { rows: [] };
    });
    const res = await request(appWithRouter()).post('/api/orgs/o1/calendar/accounts/a1/revoke');
    expect(res.statusCode).toBe(200);
    expect(tokens.removed).toBe(true);
    expect(accounts[0].is_active).toBe(false);
  });
});
