const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe('auth login', () => {
  let app;
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

    queryMock = jest.fn(async () => ({ rows: [], rowCount: 0 }));
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
    app.use('/auth', authRouter);
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'user@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 401 when user is not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'secret' });

    expect(queryMock).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('returns 401 when password does not match', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'user@test.com',
          password_hash: 'hash',
          name: 'Tester',
          org_id: 'org-1',
          roles: ['SuperAdmin'],
        },
      ],
    });
    compareMock.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('returns token, user and org on success', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'user@test.com',
          password_hash: 'hash',
          name: 'Tester',
          org_id: 'org-1',
          roles: ['SuperAdmin', 'Support'],
        },
      ],
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.roles).toEqual(['SuperAdmin', 'Support']);
    expect(res.body.org).toEqual({ id: 'org-1' });
    expect(res.body.user).toEqual({ id: 'user-1', email: 'user@test.com', name: 'Tester' });

    const payload = jwt.verify(res.body.token, 'test-secret');
    expect(payload.id).toBe('user-1');
    expect(payload.roles).toEqual(['SuperAdmin', 'Support']);
    expect(payload.org_id).toBe('org-1');
  });
});
