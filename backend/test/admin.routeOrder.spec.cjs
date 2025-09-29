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

describe('admin route order', () => {
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
    mockQuery.mockResolvedValue({ rows: [] });
    mockPool.connect.mockClear();
  });

  test('GET /api/admin/orgs?status=active -> lista sem tentar validar orgId', async () => {
    const res = await request(app)
      .get('/api/admin/orgs?status=active')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(mockQuery).toHaveBeenCalled();
  });

  test('GET /api/admin/orgs/not-a-uuid/members -> rejeitado pelo withOrgId', async () => {
    const res = await request(app)
      .get('/api/admin/orgs/not-a-uuid/members')
      .set('Authorization', `Bearer ${token}`)
      .set('x-impersonate-org-id', '00000000-0000-0000-0000-000000000001');

    expect(res.statusCode).toBe(400);
  });
});
