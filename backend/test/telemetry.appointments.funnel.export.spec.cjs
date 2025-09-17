/* eslint-env jest */

let router;
const appointmentsFunnelByDayMock = jest.fn();
const appointmentsByPersonServiceMock = jest.fn();

beforeAll(async () => {
  await jest.unstable_mockModule('../services/telemetryService.js', () => ({
    appointmentsFunnelByDay: (...args) => appointmentsFunnelByDayMock(...args),
    appointmentsByPersonService: (...args) => appointmentsByPersonServiceMock(...args),
  }));
  const authHandler = (_req, _res, next) => next();
  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: authHandler,
    authRequired: authHandler,
    default: authHandler,
  }));
  ({ default: router } = await import('../routes/telemetry.appointments.funnel.export.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  appointmentsFunnelByDayMock.mockResolvedValue([
    { day: '2025-09-20T00:00:00.000Z', requested: 4, confirmed: 2, canceled: 1, noshow: 1 },
  ]);
  appointmentsByPersonServiceMock.mockResolvedValue([
    { person: 'Rodrigo', service: 'Consulta', confirmed: 3, canceled: 0, noshow: 1 },
  ]);
});

afterAll(() => {
  jest.resetModules();
});

test('funnel export csv', async () => {
  const layer = router.stack.find((l) => l.route?.path === '/telemetry/appointments/funnel/export.csv');
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  const setHeader = jest.fn();
  const send = jest.fn();
  await handler({ query: {}, user: { org_id: 'org-1' } }, { setHeader, send }, () => {});
  const csv = send.mock.calls[0][0];
  expect(csv).toMatch(/day;requested;confirmed;canceled;noshow/);
  expect(appointmentsFunnelByDayMock).toHaveBeenCalled();
});

test('by-person-service export csv', async () => {
  const layer = router.stack.find(
    (l) => l.route?.path === '/telemetry/appointments/by-person-service/export.csv'
  );
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  const setHeader = jest.fn();
  const send = jest.fn();
  await handler({ query: {}, user: { org_id: 'org-1' } }, { setHeader, send }, () => {});
  const csv = send.mock.calls[0][0];
  expect(csv).toMatch(/person;service;confirmed;canceled;noshow/);
  expect(appointmentsByPersonServiceMock).toHaveBeenCalled();
});
