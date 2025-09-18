/**
 * Este teste importa módulos ESM via `await import(...)`.
 * Rode com: NODE_OPTIONS=--experimental-vm-modules (já embutido no script npm).
 */
if (!process.execArgv.join(' ').includes('--experimental-vm-modules')) {
  // Não falha o teste, só loga um aviso útil
  // eslint-disable-next-line no-console
  console.warn('[WARN] Execute backend tests com NODE_OPTIONS=--experimental-vm-modules (use npm run test:backend).');
}

const request = require('supertest');
const express = require('express');

process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';

const mockRefreshIfNeeded = jest.fn();
const mockForceRefresh = jest.fn();

const listMock = jest.fn();

let router;
beforeAll(async () => {
  await jest.unstable_mockModule('../services/calendar/googleTokens.js', () => ({
    refreshIfNeeded: mockRefreshIfNeeded,
    forceRefresh: mockForceRefresh,
    revokeTokens: jest.fn(),
  }));
  global.fetch = (...args) => listMock(...args);
  ({ default: router } = await import('../routes/orgs.calendar.js'));
});

beforeEach(() => {
  mockRefreshIfNeeded.mockReset();
  mockForceRefresh.mockReset();
  listMock.mockReset();
});

function appWithDb(db) {
  const app = express();
  app.use((req, _res, next) => { req.db = db; next(); });
  app.use(router);
  app.use((err, _req, res, _next) => { console.error('err', err); res.status(err.status || 500).json({ error: err.message }); });
  return app;
}

test('returns 404 when account does not belong to org', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
  const app = appWithDb(db);
  const res = await request(app).get('/api/orgs/o1/calendar/accounts/a1/events').query({ calendarId: 'c1' });
  expect(res.statusCode).toBe(404);
});

test('401 from google triggers refresh', async () => {
  const db = { query: jest.fn().mockResolvedValueOnce({ rowCount: 1 }) };
  mockRefreshIfNeeded.mockResolvedValue({ access_token: 't' });
  listMock
    .mockResolvedValueOnce({ status: 401 })
    .mockResolvedValueOnce({ ok: true, json: () => ({ items: [] }) });
  mockForceRefresh.mockResolvedValue({});
  const app = appWithDb(db);
  const res = await request(app).get('/api/orgs/o1/calendar/accounts/a1/events').query({ calendarId: 'c1' });
  expect(res.statusCode).toBe(200);
  expect(mockForceRefresh).toHaveBeenCalled();
  expect(listMock).toHaveBeenCalledTimes(2);
});

test('refresh failure causes 409 and deactivates', async () => {
  let updateCalled = false;
  const db = {
    query: jest.fn((sql) => {
      if (sql.startsWith('SELECT 1')) return Promise.resolve({ rowCount: 1 });
      if (sql.startsWith('UPDATE google_calendar_accounts')) { updateCalled = true; return Promise.resolve({}); }
      return Promise.resolve({});
    }),
  };
  mockRefreshIfNeeded.mockResolvedValue({ access_token: 't' });
  listMock.mockResolvedValue({ status: 401 });
  mockForceRefresh.mockRejectedValue(new Error('bad'));
  const app = appWithDb(db);
  const res = await request(app).get('/api/orgs/o1/calendar/accounts/a1/events').query({ calendarId: 'c1' });
  expect(res.statusCode).toBe(409);
  expect(res.body.error).toBe('reauth_required');
  expect(updateCalled).toBe(true);
});
