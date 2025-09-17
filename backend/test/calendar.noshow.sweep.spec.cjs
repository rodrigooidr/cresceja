/* eslint-env jest */

let router;
const queryMock = jest.fn();

beforeAll(async () => {
  await jest.unstable_mockModule('#db', () => ({
    query: (...args) => queryMock(...args),
  }));
  const authHandler = (_req, _res, next) => next();
  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: authHandler,
    authRequired: authHandler,
    default: authHandler,
  }));
  ({ default: router } = await import('../routes/calendar.noshow.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  queryMock.mockResolvedValue({ rowCount: 3, rows: [{ id: '1' }, { id: '2' }, { id: '3' }] });
});

afterAll(() => {
  jest.resetModules();
});

test('marca noshow nos pendentes após a graça', async () => {
  process.env.NOSHOW_ENABLED = 'true';
  const layer = router.stack.find((l) => l.route?.path === '/calendar/noshow/sweep');
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  const req = { user: { org_id: 'org-1' }, body: {} };
  const json = jest.fn();
  await handler(req, { json }, () => {});
  expect(json).toHaveBeenCalledWith({ ok: true, updated: 3 });
  expect(queryMock).toHaveBeenCalled();
});
