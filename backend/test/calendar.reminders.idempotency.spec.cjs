/* eslint-env jest */
const request = require('supertest');

describe('calendar.reminders idempotency', () => {
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
    app = await makeApp();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('primeiro POST -> idempotent:false, segundo < janela -> idempotent:true', async () => {
    const h = authHeaderFor({ role: 'orgAdmin' });
    const body = { to: '+5541999999999', channel: 'whatsapp', text: 'Ping' };
    const eventId = 'evt-id-test-1';

    const r1 = await request(app)
      .post(`/api/calendar/events/${eventId}/remind`)
      .set(h)
      .send(body);
    expect(r1.status).toBe(200);
    expect(r1.body.idempotent).toBe(false);

    const r2 = await request(app)
      .post(`/api/calendar/events/${eventId}/remind`)
      .set(h)
      .send(body);
    expect(r2.status).toBe(200);
    expect(r2.body.idempotent).toBe(true);
  });
});
