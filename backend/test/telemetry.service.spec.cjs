/* eslint-disable no-undef */
let logTelemetry;

beforeAll(async () => {
  ({ logTelemetry } = await import('../services/telemetryService.js'));
});

describe('telemetryService.logTelemetry', () => {
  const original = process.env.TELEMETRY_ENABLED;

  afterEach(() => {
    process.env.TELEMETRY_ENABLED = original;
  });

  it('inserts event when enabled', async () => {
    process.env.TELEMETRY_ENABLED = 'true';
    const calls = [];
    const fakeDb = {
      query: jest.fn(async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      }),
    };

    await logTelemetry(fakeDb, {
      orgId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000099',
      source: 'inbox',
      eventKey: 'inbox.message.sent',
      valueNum: 1,
      metadata: { sample: true },
    });

    expect(fakeDb.query).toHaveBeenCalledTimes(1);
    expect(calls[0].params[0]).toBe('00000000-0000-0000-0000-000000000001');
    expect(calls[0].params[3]).toBe('inbox.message.sent');
  });

  it('skips insert when disabled', async () => {
    process.env.TELEMETRY_ENABLED = 'false';
    const fakeDb = { query: jest.fn() };

    await logTelemetry(fakeDb, {
      orgId: '00000000-0000-0000-0000-000000000001',
      source: 'inbox',
      eventKey: 'inbox.message.sent',
    });

    expect(fakeDb.query).not.toHaveBeenCalled();
  });
});
