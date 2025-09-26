/* eslint-env jest */
const request = require('supertest');

describe('calendar.reminders rate limit', () => {
  let makeApp;
  let authHeaderFor;
  let resetDb;
  let app;
  let sendWhatsAppMock;
  let ProviderNotConfiguredMock;
  let rateLimitMock;

  beforeAll(async () => {
    jest.resetModules();
    sendWhatsAppMock = jest.fn(async () => ({ provider_message_id: 'msg-1' }));
    ProviderNotConfiguredMock = class ProviderNotConfigured extends Error {};
    rateLimitMock = jest.fn((options = {}) => {
      const limit = options.limit ?? 1;
      let count = 0;
      return (req, res, next) => {
        count += 1;
        if (count > limit) {
          res.status(429).json({ error: 'RATE_LIMIT', retryAfterSec: 60 });
          return;
        }
        next();
      };
    });

    const requireRoleMock = () => (_req, _res, next) => next();
    await jest.unstable_mockModule('../middleware/requireRole.js', () => ({
      requireRole: requireRoleMock,
      ROLES: { SuperAdmin: 'SuperAdmin', OrgAdmin: 'OrgAdmin' },
      default: { requireRole: requireRoleMock },
    }));

    await jest.unstable_mockModule('express-rate-limit', () => ({
      default: (...args) => rateLimitMock(...args),
    }));

    await jest.unstable_mockModule('../services/messaging.js', () => ({
      sendWhatsApp: (...args) => sendWhatsAppMock(...args),
      ProviderNotConfigured: ProviderNotConfiguredMock,
    }));

    await jest.unstable_mockModule('../services/audit.js', () => ({
      auditLog: jest.fn(),
    }));

    ({ makeApp, authHeaderFor, resetDb } = require('./test.helpers'));
  });

  beforeEach(async () => {
    resetDb();
    sendWhatsAppMock.mockClear();
    process.env.REMIND_RATE_LIMIT_PER_MINUTE = '3';
    app = await makeApp();
  });

  afterEach(() => {
    delete process.env.REMIND_RATE_LIMIT_PER_MINUTE;
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('retorna 429 ao estourar limite', async () => {
    const h = authHeaderFor({ role: 'orgAdmin' });
    const body = { to: '+5541999999999', channel: 'whatsapp', text: 'Ping' };
    const path = '/api/calendar/events/evt-id-test-2/remind';

    const n = parseInt(process.env.REMIND_RATE_LIMIT_PER_MINUTE || '30', 10) + 2;
    let last;
    for (let i = 0; i < n; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await request(app).post(path).set(h).send(body);
    }
    expect([200, 429]).toContain(last.status);
    expect(last.status).toBe(429);
  });
});
