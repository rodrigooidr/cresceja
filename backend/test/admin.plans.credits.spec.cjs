const express = require('express');
const request = require('supertest');

describe('Admin Plans credits API', () => {
  let router;

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('#db', () => ({
      query: jest.fn(),
    }));
    await jest.unstable_mockModule('../middleware/auth.js', () => ({
      auth: (req, _res, next) => {
        req.user = { id: 'admin-user', roles: ['SuperAdmin'], role: 'OrgAdmin' };
        next();
      },
      default: (req, _res, next) => {
        req.user = { id: 'admin-user', roles: ['SuperAdmin'], role: 'OrgAdmin' };
        next();
      },
    }));
    await jest.unstable_mockModule('../middleware/requireRole.js', () => ({
      requireGlobalRole: () => (req, _res, next) => next(),
      default: () => (req, _res, next) => next(),
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

  test('GET /api/admin/plans/:id/credits retorna ai_tokens_limit', async () => {
    const mockDb = {
      query: jest.fn((sql, params) => {
        expect(sql).toMatch(/SELECT\s+ai_tokens_limit\s+FROM\s+public\.plans\s+WHERE\s+id\s*=\s*\$1/i);
        expect(params).toEqual(['plan-123']);
        return { rows: [{ ai_tokens_limit: '150000' }] };
      }),
    };

    const app = buildApp(mockDb);
    const res = await request(app).get('/api/admin/plans/plan-123/credits');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ meter: 'ai_tokens', limit: '150000' }] });
  });

  test('PUT /api/admin/plans/:id/credits valida e atualiza limite', async () => {
    const mockDb = {
      query: jest.fn((sql, params) => {
        expect(sql).toMatch(/UPDATE\s+public\.plans\s+SET\s+ai_tokens_limit\s*=\s*\$1::bigint/i);
        expect(params).toEqual(['200000', 'plan-789']);
        return { rowCount: 1 };
      }),
    };

    const app = buildApp(mockDb);
    const res = await request(app)
      .put('/api/admin/plans/plan-789/credits')
      .send({ data: [{ meter: 'ai_tokens', limit: 200000 }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ meter: 'ai_tokens', limit: '200000' }] });
  });

  test('PUT /api/admin/plans/:id/credits com meter inválido -> 400', async () => {
    const mockDb = {
      query: jest.fn(),
    };

    const app = buildApp(mockDb);
    const res = await request(app)
      .put('/api/admin/plans/plan-999/credits')
      .send({ data: [{ meter: 'other', limit: 10 }] });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('validation_error');
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});
