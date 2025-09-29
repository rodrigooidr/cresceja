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
    mockPool.connect.mockClear();
    mockPool.on.mockClear();
    mockPool.query.mockClear();
  });

  test('GET /api/admin/orgs?status=active -> 200 items[]', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM public.organizations')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000111',
              name: 'Test Org',
              slug: 'test-org',
              plan_id: 'basic',
              trial_ends_at: null,
              status: 'active',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/orgs?status=active')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
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
