const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
const mockHealthcheck = jest.fn().mockResolvedValue(true);

function createMockClient() {
  return {
    query: mockQuery,
    release: jest.fn(),
  };
}

const mockPool = {
  query: mockQuery,
  connect: jest.fn().mockImplementation(async () => createMockClient()),
  end: jest.fn(),
  on: jest.fn(),
};

describe('Admin Orgs API', () => {
  let app;
  let token;

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('#db', () => ({
      __esModule: true,
      default: {
        query: mockQuery,
        pool: mockPool,
        healthcheck: mockHealthcheck,
        getDb: jest.fn(() => mockPool),
        getClient: jest.fn(async () => createMockClient()),
        withTransaction: jest.fn(),
        closePool: jest.fn(),
        als: { getStore: jest.fn() },
        ping: jest.fn(),
      },
      query: mockQuery,
      pool: mockPool,
      healthcheck: mockHealthcheck,
      getDb: jest.fn(() => mockPool),
      getClient: jest.fn(async () => createMockClient()),
      withTransaction: jest.fn(),
      closePool: jest.fn(),
      als: { getStore: jest.fn() },
      ping: jest.fn(),
    }));

    const { default: serverApp } = await import('../server.js');
    app = serverApp;
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
    token = jwt.sign(
      {
        id: 'admin-user',
        roles: ['SuperAdmin'],
        role: 'OrgOwner',
      },
      secret,
    );
  });

  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    mockPool.connect.mockClear();
    mockPool.on.mockClear();
    mockPool.query.mockClear();
  });

  test('GET /api/admin/orgs?status=active -> usa public.organizations e LEFT JOIN plans', async () => {
    const payload = [
      {
        id: '00000000-0000-0000-0000-000000000111',
        name: 'Test Org',
        slug: 'test-org',
        plan_id: 'basic',
        plan: 'Basic',
        trial_ends_at: null,
        status: 'active',
      },
    ];

    mockQuery.mockImplementation(async (sql, params) => {
      if (/FROM\s+public\.organizations\s+o/i.test(sql)) {
        expect(sql).not.toMatch(/::uuid/i);
        expect(sql).toMatch(/LEFT\s+JOIN\s+public\.plans\s+p\s+ON\s+p\.id\s*=\s*o\.plan_id/i);
        expect(params).toEqual(['active']);
        return { rows: payload };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/orgs?status=active')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ items: payload });
    expect(mockQuery).toHaveBeenCalled();
  });

  test('GET /api/admin/orgs?status=all -> sem filtro de status', async () => {
    mockQuery.mockImplementation(async (sql, params) => {
      if (/FROM\s+public\.organizations\s+o/i.test(sql)) {
        expect(sql).not.toMatch(/::uuid/i);
        expect(sql).not.toMatch(/o\.status\s*=\s*\$/i);
        expect(sql).toMatch(/LEFT\s+JOIN\s+public\.plans\s+p/i);
        expect(params).toEqual([]);
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/orgs?status=all')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(mockQuery).toHaveBeenCalled();
  });

  test('GET /api/admin/orgs com q aplica filtro ILIKE', async () => {
    mockQuery.mockImplementation(async (sql, params) => {
      if (/FROM\s+public\.organizations\s+o/i.test(sql)) {
        expect(sql).toMatch(/ILIKE/);
        expect(sql).not.toMatch(/::uuid/i);
        expect(sql).toMatch(/LEFT\s+JOIN\s+public\.plans\s+p/i);
        expect(params).toEqual(['inactive', '%Org%']);
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/orgs?status=inactive&q=Org')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(mockQuery).toHaveBeenCalled();
  });

  test('GET /api/admin/orgs responde items[] mesmo sem plano', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (/FROM\s+public\.organizations\s+o/i.test(sql)) {
        return { rows: [{ id: 'org-1', name: 'Org 1', plan_id: null, plan: null, trial_ends_at: null, status: 'active' }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/orgs')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          id: 'org-1',
          name: 'Org 1',
          plan_id: null,
          plan: null,
          trial_ends_at: null,
          status: 'active',
        },
      ],
    });
  });

  test('Guard de :orgId rejeita valor não-UUID', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/api/admin/orgs/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(400);
  });
});
