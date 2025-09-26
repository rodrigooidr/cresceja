/* eslint-env jest */
let router;
let createRouter;
let authHandler;
const queryMock = jest.fn();
const ensureTokenMock = jest.fn();
const requireRoleFactory = () => (_req, _res, next) => next();
const rateLimitMock = jest.fn(() => (_req, _res, next) => next());
const sendWhatsAppMock = jest.fn(async () => ({ provider_message_id: 'msg-123' }));

beforeAll(async () => {
  await jest.unstable_mockModule('#db', () => ({
    query: (...args) => queryMock(...args),
    pool: { query: (...args) => queryMock(...args) },
    default: { query: (...args) => queryMock(...args) },
  }));
  authHandler = (req, _res, next) => {
    req.user = req.user || { org_id: 'org-1' };
    next();
  };
  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: authHandler,
    authRequired: authHandler,
    default: authHandler,
  }));
  await jest.unstable_mockModule('../middleware/requireRole.js', () => ({
    requireRole: requireRoleFactory,
    ROLES: { SuperAdmin: 'SuperAdmin', OrgAdmin: 'OrgAdmin' },
    default: { requireRole: requireRoleFactory },
  }));
  await jest.unstable_mockModule('express-rate-limit', () => ({
    default: (...args) => rateLimitMock(...args),
  }));
  await jest.unstable_mockModule('../services/calendar/rsvp.js', () => ({
    ensureToken: (...args) => ensureTokenMock(...args),
  }));
  await jest.unstable_mockModule('../services/messaging.js', () => ({
    sendWhatsApp: (...args) => sendWhatsAppMock(...args),
    ProviderNotConfigured: class ProviderNotConfigured extends Error {},
  }));
  ({ default: createRouter } = await import('../routes/calendar.reminders.one.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  ensureTokenMock.mockResolvedValue('tk-1');
  queryMock.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM public.calendar_events ce')) {
      return {
        rows: [
          {
            id: 'loc-1',
            summary: 'Consulta',
            start_at: '2025-09-23T17:00:00.000Z',
            calendar_id: 'Rodrigo',
            display_name: 'Cliente',
            phone_e164: '+5511999999999',
          },
        ],
      };
    }
    if (text.includes('UPDATE public.calendar_events SET reminder_sent_at')) {
      return { rows: [] };
    }
    return { rows: [] };
  });
  router = createRouter({
    db: { query: (...args) => queryMock(...args) },
    requireAuth: authHandler,
    requireRole: requireRoleFactory,
    ROLES: { SuperAdmin: 'SuperAdmin', OrgAdmin: 'OrgAdmin' },
  });
});

afterEach(() => {
  sendWhatsAppMock.mockClear();
});

afterAll(() => {
  jest.resetModules();
});

test('envia lembrete individual', async () => {
  const layer = router.stack.find((l) => l.route?.path === '/api/calendar/events/:id/remind');
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  const req = {
    params: { id: 'loc-1' },
    user: { org_id: 'org-1' },
    body: { to: '+5511999999999', channel: 'whatsapp', text: 'Lembrete' },
  };
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  await handler(req, { json, status }, () => {});
  expect(json).toHaveBeenCalledWith({ idempotent: false, ok: true });
  expect(sendWhatsAppMock).toHaveBeenCalledWith('+5511999999999', 'Lembrete', expect.any(Object));
});
