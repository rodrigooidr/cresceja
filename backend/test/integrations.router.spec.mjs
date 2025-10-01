import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createIntegrationsRouter } from '../routes/integrations.js';
import { createTestDb } from './utils/db.mem.mjs';
import { runMigrations } from './utils/runMigrations.mjs';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpClientError } from '../utils/httpClient.js';

const fakeSeal = (value = {}) => ({
  c: Buffer.from(JSON.stringify(value), 'utf8').toString('base64'),
  v: 1,
});

const fakeOpen = (sealed) => {
  if (!sealed || typeof sealed !== 'object') return {};
  if (typeof sealed.c === 'string') {
    try {
      const json = Buffer.from(sealed.c, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
  return { ...sealed };
};

const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const fakeHttpClient = {
  post: jest.fn(async () => ({ status: 200, data: {} })),
  request: jest.fn(),
};

describe('integrations router', () => {
  let db;
  let orgId;
  let app;
  let adminToken;
  let agentToken;

  const calendarPayload = {
    calendarId: 'primary',
    clientEmail: 'bot@example.com',
    privateKey: '-----BEGIN PRIVATE KEY-----abc1234567890',
    timezone: 'America/Sao_Paulo',
  };

  const facebookPayload = {
    user_access_token: 'token-abc1234567890',
    page_id: '123456',
    page_name: 'Test Page',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev';
    orgId = randomUUID();
    db = createTestDb();
    await runMigrations({ db });
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`, [orgId, 'Test Org', 'test-org']);
    adminToken = createToken('OrgAdmin');
    agentToken = createToken('OrgAgent');
    app = buildApp();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    fakeHttpClient.post.mockReset();
    fakeHttpClient.post.mockResolvedValue({ status: 200, data: {} });
    await db.query('TRUNCATE org_integrations RESTART IDENTITY CASCADE');
    try {
      await db.query('TRUNCATE integration_audit_logs RESTART IDENTITY CASCADE');
    } catch {}
  });

  function createToken(role) {
    return jwt.sign(
      {
        id: 'user-1',
        org_id: orgId,
        role,
        roles: [],
      },
      process.env.JWT_SECRET
    );
  }

  function buildApp({ httpClient = fakeHttpClient, rateLimitOptions } = {}) {
    const application = express();
    application.use(express.json());
    const router = createIntegrationsRouter({
      db,
      seal: fakeSeal,
      open: fakeOpen,
      logger: fakeLogger,
      httpClient,
      rateLimitOptions,
    });
    const requireAdmin = requireRole('OrgAdmin', 'OrgOwner');
    application.use('/api/integrations', authRequired, requireAdmin, router);
    return application;
  }

  function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  it('rejects requests without bearer token', async () => {
    const response = await request(app).get('/api/integrations/status');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'missing_token' });
  });

  it('rejects users without required role', async () => {
    const response = await request(app)
      .get('/api/integrations/status')
      .set(authHeader(agentToken));
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: 'forbidden' });
  });

  it('lists available providers with default status', async () => {
    const response = await request(app)
      .get('/api/integrations/status')
      .set(authHeader(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.providers).toHaveProperty('google_calendar');
    expect(response.body.providers.google_calendar).toMatchObject({
      provider: 'google_calendar',
      status: 'disconnected',
      subscribed: false,
    });
  });

  it('returns validation error for unknown providers', async () => {
    const response = await request(app)
      .get('/api/integrations/providers/unknown')
      .set(authHeader(adminToken));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'unknown_provider' });
  });

  it('stores sealed credentials when connecting to google calendar', async () => {
    const response = await request(app)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send(calendarPayload);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.integration).toMatchObject({
      provider: 'google_calendar',
      status: 'connected',
      subscribed: false,
    });
    expect(response.body.integration).not.toHaveProperty('creds');

    const { rows } = await db.query(
      'SELECT creds FROM org_integrations WHERE org_id = $1 AND provider = $2',
      [orgId, 'google_calendar']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].creds).toHaveProperty('c');
    expect(fakeOpen(rows[0].creds)).toMatchObject(calendarPayload);
  });

  it('returns sanitized integration without secrets', async () => {
    await request(app)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send(calendarPayload);

    const response = await request(app)
      .get('/api/integrations/providers/google_calendar')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.integration).toMatchObject({
      provider: 'google_calendar',
      status: 'connected',
      subscribed: false,
    });
    expect(response.body.integration).not.toHaveProperty('creds');
    expect(response.body.integration.meta).toMatchObject({
      calendarId: calendarPayload.calendarId,
      clientEmail: calendarPayload.clientEmail,
      timezone: calendarPayload.timezone,
    });
  });

  it('tests google calendar connection successfully', async () => {
    await request(app)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send(calendarPayload);

    const response = await request(app)
      .post('/api/integrations/providers/google_calendar/test')
      .set(authHeader(adminToken))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.integration.status).toBe('connected');
  });

  it('disconnects google calendar and clears credentials', async () => {
    await request(app)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send(calendarPayload);

    const response = await request(app)
      .post('/api/integrations/providers/google_calendar/disconnect')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.integration).toMatchObject({
      provider: 'google_calendar',
      status: 'disconnected',
      subscribed: false,
    });
    expect(response.body.integration).not.toHaveProperty('creds');
  });

  it('rejects invalid payloads with validation_error', async () => {
    const response = await request(app)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send({ calendarId: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('subscribes to facebook using external http client', async () => {
    await request(app)
      .post('/api/integrations/providers/meta_facebook/connect')
      .set(authHeader(adminToken))
      .send(facebookPayload);

    fakeHttpClient.post.mockClear();

    const response = await request(app)
      .post('/api/integrations/providers/meta_facebook/subscribe')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.integration.subscribed).toBe(true);
    expect(fakeHttpClient.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = fakeHttpClient.post.mock.calls[0];
    expect(url).toContain(facebookPayload.page_id);
    expect(body).toHaveProperty('subscribed_fields');
    expect(options.headers.Authorization).toContain('Bearer');
  });

  it('maps provider failures to provider_error responses', async () => {
    await request(app)
      .post('/api/integrations/providers/meta_facebook/connect')
      .set(authHeader(adminToken))
      .send(facebookPayload);

    fakeHttpClient.post.mockImplementationOnce(() => {
      throw new HttpClientError('falha externa', { status: 500 });
    });

    const response = await request(app)
      .post('/api/integrations/providers/meta_facebook/subscribe')
      .set(authHeader(adminToken));

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({ error: 'provider_error', message: 'falha externa' });
  });

  it('applies rate limiting to critical actions', async () => {
    const localHttpClient = { post: jest.fn(async () => ({ status: 200, data: {} })) };
    const limitedApp = buildApp({
      httpClient: localHttpClient,
      rateLimitOptions: { limit: 2, windowMs: 60_000 },
    });

    await request(limitedApp)
      .post('/api/integrations/providers/google_calendar/connect')
      .set(authHeader(adminToken))
      .send(calendarPayload);

    const first = await request(limitedApp)
      .post('/api/integrations/providers/google_calendar/test')
      .set(authHeader(adminToken))
      .send({});
    expect(first.status).toBe(200);

    const rateLimited = await request(limitedApp)
      .post('/api/integrations/providers/google_calendar/test')
      .set(authHeader(adminToken))
      .send({});

    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body).toMatchObject({ error: 'rate_limited' });
  });
});
