const express = require('express');
const request = require('supertest');

describe('GET /api/orgs/:orgId/plan/summary', () => {
  let router;

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('#db', () => ({
      pool: {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release: () => {},
        }),
      },
    }));
    await jest.unstable_mockModule('../middleware/auth.js', () => ({
      auth: (req, _res, next) => {
        const role = req.headers['x-test-role'] || 'OrgAdmin';
        const globals = String(req.headers['x-test-global-roles'] || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        req.user = { id: 'user-1', role, roles: globals };
        next();
      },
      default: (req, res, next) => {
        const role = req.headers['x-test-role'] || 'OrgAdmin';
        const globals = String(req.headers['x-test-global-roles'] || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        req.user = { id: 'user-1', role, roles: globals };
        next();
      },
    }));
    router = (await import('../routes/orgs.js')).default;
  });

  function buildApp(mockDb) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.db = mockDb;
      next();
    });
    app.use('/api/orgs', router);
    return app;
  }

  function createMockDb({ org, credits }) {
    return {
      query: jest.fn((sql, params) => {
        if (/FROM public\.organizations/.test(sql)) {
          expect(params[0]).toBe(org.id);
          return { rows: [org] };
        }
        if (/FROM public\.v_org_credits/.test(sql)) {
          expect(params[0]).toBe(org.id);
          return { rows: credits };
        }
        return { rows: [] };
      }),
    };
  }

  const summaryData = {
    org: { id: 'org-1', plan_id: 'starter', trial_ends_at: '2025-01-01T00:00:00.000Z' },
    credits: [
      { org_id: 'org-1', feature_code: 'posts', remaining_total: 45, expires_next: '2025-12-26T00:00:00.000Z' },
      { org_id: 'org-1', feature_code: 'whatsapp_numbers', remaining_total: 1, expires_next: '2025-10-27T00:00:00.000Z' },
    ],
  };

  test('allows OrgAdmin', async () => {
    const mockDb = createMockDb(summaryData);
    const app = buildApp(mockDb);

    const res = await request(app)
      .get('/api/orgs/org-1/plan/summary')
      .set('x-test-role', 'OrgAdmin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      org_id: 'org-1',
      plan_id: 'starter',
      trial_ends_at: '2025-01-01T00:00:00.000Z',
      credits: [
        { feature_code: 'posts', remaining_total: 45, expires_next: '2025-12-26T00:00:00.000Z' },
        { feature_code: 'whatsapp_numbers', remaining_total: 1, expires_next: '2025-10-27T00:00:00.000Z' },
      ],
    });
  });

  test('allows OrgOwner', async () => {
    const mockDb = createMockDb(summaryData);
    const app = buildApp(mockDb);

    const res = await request(app)
      .get('/api/orgs/org-1/plan/summary')
      .set('x-test-role', 'OrgOwner');

    expect(res.status).toBe(200);
  });

  test('allows global roles (Support)', async () => {
    const mockDb = createMockDb(summaryData);
    const app = buildApp(mockDb);

    const res = await request(app)
      .get('/api/orgs/org-1/plan/summary')
      .set('x-test-role', 'OrgViewer')
      .set('x-test-global-roles', 'Support');

    expect(res.status).toBe(200);
  });

  test('denies roles without permission', async () => {
    const mockDb = {
      query: jest.fn(() => {
        throw new Error('should not query for forbidden request');
      }),
    };
    const app = buildApp(mockDb);
    const res = await request(app)
      .get('/api/orgs/org-1/plan/summary')
      .set('x-test-role', 'OrgAgent');

    expect(res.status).toBe(403);
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});
