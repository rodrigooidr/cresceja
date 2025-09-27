const express = require('express');

async function httpRequest(app, method, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${path}`;
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch (err) {
      data = text;
    }
    return { statusCode: response.status, body: data };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('admin plans routes', () => {
  let router;
  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('#db', () => ({
      query: jest.fn(async () => ({ rows: [] })),
    }));
    router = (await import('../routes/admin/plans.js')).default;
  });

  function buildApp(mockDb, user = { roles: ['SuperAdmin'] }) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { ...user };
      req.db = mockDb;
      next();
    });
    app.use('/api/admin/plans', router);
    return app;
  }

  test('GET lista planos trazendo payload em data', async () => {
    const mockDb = {
      query: jest.fn((sql) => {
        if (/FROM public\.plans/.test(sql)) {
          return {
            rows: [
              {
                id: 'plan1',
                slug: 'legacy-plan',
                name: 'Plan 1',
                monthly_price: 99,
                currency: 'BRL',
                modules: null,
                is_published: true,
                is_active: true,
                is_free: false,
                trial_days: 7,
                billing_period_months: 1,
                price_cents: 9900,
                sort_order: 1,
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-02'),
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const res = await httpRequest(app, 'GET', '/api/admin/plans');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({ id: 'plan1', slug: 'legacy-plan', name: 'Plan 1' });
  });

  test('GET features retorna dados normalizados', async () => {
    const planFeaturesRows = [
      {
        plan_id: 'plan1',
        feature_code: 'whatsapp_numbers',
        code: 'whatsapp_numbers',
        type: 'number',
        value: { enabled: true, limit: 1 },
      },
      {
        plan_id: 'plan1',
        feature_code: 'whatsapp_mode_baileys',
        code: 'whatsapp_mode_baileys',
        type: 'boolean',
        value: { enabled: false },
      },
    ];
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.startsWith('SELECT to_regclass')) {
          return { rows: [{ oid: 'plan_features' }] };
        }
        if (sql.includes('FROM information_schema.columns')) {
          return {
            rows: [
              { column_name: 'plan_id' },
              { column_name: 'feature_code' },
              { column_name: 'value' },
              { column_name: 'type' },
            ],
          };
        }
        if (sql.includes('FROM public.plan_features')) {
          expect(params[0]).toBe('plan1');
          return { rows: planFeaturesRows };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const res = await httpRequest(app, 'GET', '/api/admin/plans/plan1/features');
    expect(res.statusCode).toBe(200);
    const codes = res.body?.data?.map((item) => item.code);
    expect(codes).toEqual(['whatsapp_numbers', 'whatsapp_mode_baileys']);
    const first = res.body.data[0];
    expect(first).toMatchObject({ plan_id: 'plan1', code: 'whatsapp_numbers' });
    expect(first.value.limit).toBe(1);
  });

  test('PUT faz UPSERT e GET reflete mudança', async () => {
    const featureDefs = [
      { code: 'whatsapp_numbers', type: 'number' },
      { code: 'google_calendar_accounts', type: 'number' },
    ];
    const storedFeatures = {};
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.startsWith('SELECT to_regclass')) {
          return { rows: [{ oid: 'plan_features' }] };
        }
        if (sql.includes('FROM information_schema.columns')) {
          return {
            rows: [
              { column_name: 'plan_id' },
              { column_name: 'feature_code' },
              { column_name: 'value' },
              { column_name: 'type' },
            ],
          };
        }
        if (sql.includes('FROM feature_defs')) {
          return { rows: featureDefs };
        }
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO plan_features')) {
          const [planId, code, val] = params;
          storedFeatures[code] = {
            plan_id: planId,
            feature_code: code,
            code,
            type: featureDefs.find((d) => d.code === code)?.type ?? null,
            value: JSON.parse(val),
          };
          return { rows: [] };
        }
        if (sql.includes('FROM public.plan_features')) {
          return { rows: Object.values(storedFeatures) };
        }
        if (/FROM public\.plans/.test(sql)) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };

    const app = buildApp(mockDb);
    const body = {
      features: {
        whatsapp_numbers: { limit: 3 },
        google_calendar_accounts: { limit: 2 },
      },
    };
    const putRes = await httpRequest(app, 'PUT', '/api/admin/plans/plan1/features', body);
    expect(putRes.statusCode).toBe(200);
    expect(storedFeatures.whatsapp_numbers.value).toEqual({ enabled: true, limit: 3 });

    const getRes = await httpRequest(app, 'GET', '/api/admin/plans/plan1/features');
    const numbers = getRes.body.data.find((item) => item.code === 'whatsapp_numbers');
    expect(numbers.value.limit).toBe(3);
  });

  test('403 quando user não tem role', async () => {
    const mockDb = { query: jest.fn(() => ({ rows: [] })) };
    const app = buildApp(mockDb, { roles: [] });
    const res = await httpRequest(app, 'GET', '/api/admin/plans');
    expect(res.statusCode).toBe(403);
  });
});
