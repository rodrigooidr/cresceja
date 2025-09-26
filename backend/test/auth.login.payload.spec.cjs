const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe('auth login payload', () => {
  let app;
  let scenario;
  let compareMock;
  let queryMock;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = ORIGINAL_SECRET;
  });

  beforeEach(async () => {
    jest.resetModules();
    scenario = {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.com',
        password_hash: 'hash',
      },
      orgMemberships: [],
      globalRoles: [],
    };

    queryMock = jest.fn(async (sql) => {
      const text = String(sql).toLowerCase();
      if (text.includes('from public.users')) {
        return { rows: [scenario.user], rowCount: 1 };
      }
      if (text.includes('from public.org_members')) {
        return { rows: scenario.orgMemberships, rowCount: scenario.orgMemberships.length };
      }
      if (text.includes('from public.user_global_roles')) {
        return { rows: scenario.globalRoles, rowCount: scenario.globalRoles.length };
      }
      return { rows: [], rowCount: 0 };
    });

    compareMock = jest.fn().mockResolvedValue(true);

    await jest.unstable_mockModule('#db', () => ({
      __esModule: true,
      query: queryMock,
    }));
    await jest.unstable_mockModule('bcryptjs', () => ({
      __esModule: true,
      default: { compare: compareMock },
    }));

    const { default: authRouter } = await import('../routes/auth.js');
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  it('emits org-only payload with OrgAgent role', async () => {
    scenario.orgMemberships = [{ org_id: 'org-1', role: 'OrgAgent' }];

    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'secret' });
    expect(res.status).toBe(200);
    const { token, user } = res.body;
    expect(user.role).toBe('OrgAgent');
    expect(user.roles).toEqual([]);
    expect(user.org_id).toBe('org-1');

    const payload = jwt.verify(token, 'test-secret');
    expect(payload.role).toBe('OrgAgent');
    expect(payload.roles).toEqual([]);
    expect(payload.org_id).toBe('org-1');
  });

  it('includes global SuperAdmin role', async () => {
    scenario.orgMemberships = [];
    scenario.globalRoles = [{ role: 'SuperAdmin' }];

    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'secret' });
    expect(res.status).toBe(200);
    const { token, user } = res.body;
    expect(user.role).toBe('OrgViewer');
    expect(user.roles).toEqual(['SuperAdmin']);

    const payload = jwt.verify(token, 'test-secret');
    expect(payload.roles).toEqual(['SuperAdmin']);
    expect(payload.role).toBe('OrgViewer');
  });

  it('returns support global role without elevating to super admin', async () => {
    scenario.orgMemberships = [{ org_id: 'org-9', role: 'OrgViewer' }];
    scenario.globalRoles = [{ role: 'Support' }];

    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'secret' });
    expect(res.status).toBe(200);
    const { token, user } = res.body;
    expect(user.role).toBe('OrgViewer');
    expect(user.roles).toEqual(['Support']);

    const payload = jwt.verify(token, 'test-secret');
    expect(payload.roles).toEqual(['Support']);
    expect(payload.role).toBe('OrgViewer');
  });

  it('/auth/me mirrors token payload', async () => {
    scenario.orgMemberships = [{ org_id: 'org-2', role: 'OrgOwner' }];
    scenario.globalRoles = [{ role: 'Support' }];

    const login = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'secret' });
    const token = login.body.token;
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('OrgOwner');
    expect(me.body.roles).toEqual(['Support']);
    expect(me.body.org_id).toBe('org-2');
  });
});
