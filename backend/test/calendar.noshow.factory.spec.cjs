import express from 'express';
const request = require('supertest');

let createNoShowRouter;

beforeAll(async () => {
  ({ createNoShowRouter } = await import('../routes/calendar.noshow.js'));
});

describe('calendar no-show router factory', () => {
  const allowAll = (_req, _res, next) => next();

  function buildApp({ sweepNoShowFn }) {
    const app = express();
    const router = createNoShowRouter({
      db: { query: jest.fn() },
      requireAuth: (req, _res, next) => {
        req.user = { id: 'user-1', role: 'OrgAdmin', roles: [] };
        next();
      },
      requireRole: () => allowAll,
      sweepNoShowFn,
    });
    app.use(router);
    return app;
  }

  it('keeps legacy endpoints with same response shape', async () => {
    const sweep = jest.fn().mockResolvedValue(['a', 'b']);
    const app = buildApp({ sweepNoShowFn: sweep });

    for (const path of ['/sweep', '/calendar/noshow/sweep', '/api/calendar/noshow/sweep']) {
      const res = await request(app).post(path);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true, updated: 2 });
    }

    expect(sweep).toHaveBeenCalled();
  });

  it('passes dependencies to custom sweep function', async () => {
    const sweep = jest.fn().mockResolvedValue(['1']);
    const fakeDb = { marker: true, query: jest.fn() };
    const app = express();
    const router = createNoShowRouter({
      db: fakeDb,
      requireAuth: (req, _res, next) => {
        req.user = { id: 'user-1', role: 'OrgAdmin', roles: [] };
        next();
      },
      requireRole: () => allowAll,
      sweepNoShowFn: sweep,
    });
    app.use(router);

    const res = await request(app).post('/api/calendar/noshow/sweep');
    expect(res.statusCode).toBe(200);
    expect(sweep).toHaveBeenCalledWith({ db: fakeDb, graceMinutes: expect.any(Number) });
  });
});
