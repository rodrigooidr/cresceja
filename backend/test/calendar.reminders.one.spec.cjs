/* eslint-env jest */
let router;
const queryMock = jest.fn();
const ensureTokenMock = jest.fn();

beforeAll(async () => {
  await jest.unstable_mockModule('#db', () => ({
    query: (...args) => queryMock(...args),
  }));
  const authHandler = (req, _res, next) => {
    req.user = req.user || { org_id: 'org-1' };
    next();
  };
  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: authHandler,
    authRequired: authHandler,
    default: authHandler,
  }));
  await jest.unstable_mockModule('../services/calendar/rsvp.js', () => ({
    ensureToken: (...args) => ensureTokenMock(...args),
  }));
  ({ default: router } = await import('../routes/calendar.reminders.one.js'));
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
  global.fetch = jest.fn(async () => ({ ok: true }));
});

afterEach(() => {
  delete global.fetch;
});

afterAll(() => {
  jest.resetModules();
});

test('envia lembrete individual', async () => {
  const layer = router.stack.find((l) => l.route?.path === '/calendar/events/:id/remind');
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  const req = { params: { id: 'loc-1' }, user: { org_id: 'org-1' } };
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  await handler(req, { json, status }, () => {});
  expect(json).toHaveBeenCalledWith({ ok: true });
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/whatsapp/send'),
    expect.objectContaining({ method: 'POST' })
  );
  expect(ensureTokenMock).toHaveBeenCalledWith('loc-1');
});
