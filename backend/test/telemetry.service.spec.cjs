/* eslint-disable no-undef */
let logTelemetry;
let auditLogMock;

async function importService() {
  jest.resetModules();
  auditLogMock = jest.fn(async () => {});

  jest.unstable_mockModule('../services/audit.js', () => ({
    __esModule: true,
    default: { auditLog: auditLogMock },
    auditLog: auditLogMock,
  }));

  ({ logTelemetry } = await import('../services/telemetryService.js'));
}

describe('telemetryService.logTelemetry', () => {
  const originalEnabled = process.env.TELEMETRY_ENABLED;
  const originalStorage = process.env.TELEMETRY_STORAGE;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.TELEMETRY_ENABLED;
    } else {
      process.env.TELEMETRY_ENABLED = originalEnabled;
    }

    if (originalStorage === undefined) {
      delete process.env.TELEMETRY_STORAGE;
    } else {
      process.env.TELEMETRY_STORAGE = originalStorage;
    }
  });

  it('audits and inserts into table when storage mode is table', async () => {
    process.env.TELEMETRY_ENABLED = 'true';
    process.env.TELEMETRY_STORAGE = 'table';
    await importService();

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

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(fakeDb.query).toHaveBeenCalledTimes(1);
    expect(calls[0].params[0]).toBe('00000000-0000-0000-0000-000000000001');
    expect(calls[0].params[3]).toBe('inbox.message.sent');
  });

  it('only audits when storage mode is audit', async () => {
    process.env.TELEMETRY_ENABLED = 'true';
    process.env.TELEMETRY_STORAGE = 'audit';
    await importService();

    const fakeDb = { query: jest.fn() };

    await logTelemetry(fakeDb, {
      orgId: '00000000-0000-0000-0000-000000000001',
      source: 'inbox',
      eventKey: 'inbox.message.sent',
    });

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(fakeDb.query).not.toHaveBeenCalled();
  });

  it('skips everything when telemetry is disabled', async () => {
    process.env.TELEMETRY_ENABLED = 'false';
    process.env.TELEMETRY_STORAGE = 'table';
    await importService();

    const fakeDb = { query: jest.fn() };

    await logTelemetry(fakeDb, {
      orgId: '00000000-0000-0000-0000-000000000001',
      source: 'inbox',
      eventKey: 'inbox.message.sent',
    });

    expect(auditLogMock).not.toHaveBeenCalled();
    expect(fakeDb.query).not.toHaveBeenCalled();
  });
});
