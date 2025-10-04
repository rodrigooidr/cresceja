import express from 'express';
const request = require('supertest');

let createHealthRouter;

beforeAll(async () => {
  ({ createHealthRouter } = await import('../routes/health.js'));
});

describe('health router', () => {
  function buildApp(opts) {
    const app = express();
    app.use('/api/health', createHealthRouter(opts));
    return app;
  }

  it('returns UP with skipped DB when flag requests skip', async () => {
    const app = buildApp({
      healthcheckFn: jest.fn(),
      getDbConfig: () => ({ skip: true, reason: 'skipped', requested: true }),
      now: () => new Date('2024-01-01T00:00:00.000Z'),
      uptimeFn: () => 42,
    });

    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toBe('UP (db: skipped)');
    expect(res.body.checks.db).toMatchObject({ status: 'skipped', mode: 'skipped', requestedSkip: true });
    expect(res.body.time).toBe('2024-01-01T00:00:00.000Z');
    expect(res.body.uptime).toBe(42);
  });

  it('runs DB healthcheck when not skipped', async () => {
    const healthcheckFn = jest.fn().mockResolvedValue(true);
    const app = buildApp({
      healthcheckFn,
      getDbConfig: () => ({ skip: false, reason: 'enabled', requested: false }),
    });

    const res = await request(app).get('/api/health');
    expect(healthcheckFn).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toBe('UP (db: ok)');
    expect(res.body.checks.db.status).toBe('ok');
  });

  it('propagates DB failure as 503', async () => {
    const error = new Error('db down');
    const app = buildApp({
      healthcheckFn: jest.fn().mockRejectedValue(error),
      getDbConfig: () => ({ skip: false, reason: 'enabled', requested: false }),
    });

    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(503);
    expect(res.body.summary).toBe('DOWN (db: error)');
    expect(res.body.checks.db.error).toBe('db down');
  });
});
