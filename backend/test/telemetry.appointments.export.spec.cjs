/* eslint-env jest */

let router;

beforeAll(async () => {
  jest.resetModules();
  jest.unstable_mockModule('../services/telemetryService.js', () => ({
    appointmentsOverview: jest.fn(async () => [
      {
        day: '2025-09-20T00:00:00.000Z',
        pending: 1,
        confirmed: 2,
        canceled: 1,
        noshow: 0,
        reminded: 3,
      },
    ]),
  }));
  jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: (_req, _res, next) => next(),
  }));
  ({ default: router } = await import('../routes/telemetry.appointments.export.js'));
});

function getRouteHandler(r, path) {
  const layer = r.stack.find((l) => l.route?.path === path);
  const stack = layer?.route?.stack || [];
  return stack[stack.length - 1]?.handle;
}

test('CSV export responde 200 e retorna cabeçalho', async () => {
  const handler = getRouteHandler(router, '/telemetry/appointments/export.csv');
  expect(handler).toBeInstanceOf(Function);
  const req = {
    query: { from: '2025-09-19T00:00:00.000Z', to: '2025-09-21T00:00:00.000Z' },
    user: { org_id: 'org-1' },
  };
  const res = {
    setHeader: jest.fn(),
    send: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  await handler(req, res, next);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
  expect(res.setHeader).toHaveBeenCalledWith(
    'Content-Disposition',
    expect.stringContaining('appointments_2025-09-19_2025-09-21.csv'),
  );
  expect(res.send).toHaveBeenCalled();
  const csv = res.send.mock.calls[0][0];
  expect(csv).toMatch(/day;pending;confirmed;canceled;noshow;reminded/i);
  expect(csv).toMatch(/2025-09-20/);
  expect(next).not.toHaveBeenCalled();
});
