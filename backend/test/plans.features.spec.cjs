import express from 'express';
const request = require('supertest');

describe('Admin Plans routes', () => {
  let router;

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('#db', () => ({
      query: jest.fn(),
    }));
    await jest.unstable_mockModule('../middleware/auth.js', () => ({
      auth: (req, _res, next) => {
        req.user = { id: 'user-1', roles: ['SuperAdmin'], role: 'OrgAdmin' };
        next();
      },
      default: (req, _res, next) => {
        req.user = { id: 'user-1', roles: ['SuperAdmin'], role: 'OrgAdmin' };
        next();
      },
    }));
    router = (await import('../routes/admin/plans.js')).default;
  });

  function buildApp(mockDb) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.db = mockDb;
      next();
    });
    app.use('/api/admin/plans', router);
    return app;
  }

  test('GET /api/admin/plans returns normalized list', async () => {
    const mockDb = {
      query: jest.fn((sql) => {
        if (/FROM public\.plans/.test(sql)) {
          return {
            rows: [
              {
                id: 'plan-basic',
                id_legacy_text: 'legacy-basic',
                name: 'Basic',
                monthly_price: 99.9,
                currency: 'BRL',
                modules: { marketing: true },
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const res = await request(app).get('/api/admin/plans');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual({
      id: 'plan-basic',
      id_legacy_text: 'legacy-basic',
      name: 'Basic',
      monthly_price: 99.9,
      currency: 'BRL',
      modules: { marketing: true },
    });
  });

  test('GET /api/admin/plans/:id/features merges defs and values', async () => {
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (/SELECT code, label, type, enum_options\s+FROM feature_defs/.test(sql)) {
          return {
            rows: [
              { code: 'posts', label: 'Posts', type: 'number', enum_options: null },
              { code: 'whatsapp_numbers', label: 'WhatsApp Numbers', type: 'number', enum_options: null },
              { code: 'channel', label: 'Channel', type: 'enum', enum_options: ['basic', 'advanced'] },
            ],
          };
        }
        if (/FROM plan_features/.test(sql)) {
          expect(params[0]).toBe('plan-basic');
          return {
            rows: [
              { code: 'posts', value: { value: 120 } },
              { code: 'channel', value: { value: 'advanced' } },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const res = await request(app).get('/api/admin/plans/plan-basic/features');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const channel = res.body.find((item) => item.code === 'channel');
    expect(channel).toMatchObject({
      code: 'channel',
      label: 'Channel',
      type: 'enum',
      options: ['basic', 'advanced'],
      value: 'advanced',
    });
  });

  test('PUT /api/admin/plans/:id/features upserts payload', async () => {
    const stored = [];
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (/SELECT code, type, enum_options/.test(sql)) {
          return {
            rows: [
              { code: 'posts', type: 'number', enum_options: null },
              { code: 'channel', type: 'enum', enum_options: ['basic', 'advanced'] },
            ],
          };
        }
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (/INSERT INTO plan_features/.test(sql)) {
          stored.push({ planId: params[0], code: params[1], value: JSON.parse(params[2]).value });
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const payload = [
      { code: 'posts', type: 'number', value: 250 },
      { code: 'channel', type: 'enum', value: 'basic', options: ['basic', 'advanced'] },
    ];

    const res = await request(app)
      .put('/api/admin/plans/plan-basic/features')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(stored).toEqual([
      { planId: 'plan-basic', code: 'posts', value: 250 },
      { planId: 'plan-basic', code: 'channel', value: 'basic' },
    ]);
  });
});
