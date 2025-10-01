import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createIntegrationsRouter } from '../routes/integrations.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createTestDb } from './utils/db.mem.mjs';
import { runMigrations } from './utils/runMigrations.mjs';

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

describe('integrations router rate limit', () => {
  let db;
  let app;
  let orgId;
  let adminToken;
  const httpClient = { post: jest.fn(), request: jest.fn() };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev-secret';
    db = createTestDb();
    await runMigrations({ db });
    orgId = randomUUID();
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`, [
      orgId,
      'Org Test',
      'org-test',
    ]);
    const sealedCreds = fakeSeal({
      calendarId: 'primary',
      clientEmail: 'bot@example.com',
      privateKey: '-----BEGIN PRIVATE KEY-----abc1234567890',
      timezone: 'America/Sao_Paulo',
    });
    await db.query(
      `INSERT INTO org_integrations (org_id, provider, status, subscribed, creds, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       ON CONFLICT (org_id, provider)
       DO UPDATE SET status = EXCLUDED.status, subscribed = EXCLUDED.subscribed, creds = EXCLUDED.creds, meta = EXCLUDED.meta`,
      [orgId, 'google_calendar', 'connected', true, JSON.stringify(sealedCreds), JSON.stringify({})]
    );
    adminToken = jwt.sign(
      {
        id: 'user-1',
        org_id: orgId,
        role: 'OrgAdmin',
        roles: [],
      },
      process.env.JWT_SECRET
    );
    app = buildApp();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(() => {
    httpClient.post.mockReset();
    httpClient.post.mockResolvedValue({ status: 200, data: {} });
  });

  function buildApp() {
    const application = express();
    application.use(express.json());
    application.use((req, _res, next) => {
      req.db = db;
      next();
    });
    const router = createIntegrationsRouter({
      db,
      seal: fakeSeal,
      open: fakeOpen,
      logger: fakeLogger,
      httpClient,
      rateLimitOptions: {
        windowMs: 1_000,
        limit: 2,
      },
    });
    const guard = requireRole('OrgAdmin', 'OrgOwner');
    application.use('/api/integrations', authRequired, guard, router);
    application.use((err, _req, res, _next) => {
      res.status(500).json({ error: 'unhandled', message: err.message });
    });
    return application;
  }

  function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  it('responds with 429 after hitting the rate limit', async () => {
    const endpoint = '/api/integrations/providers/google_calendar/test';

    const first = await request(app).post(endpoint).set(authHeader(adminToken));
    expect(first.status).toBe(200);

    const second = await request(app).post(endpoint).set(authHeader(adminToken));
    expect(second.status).toBe(200);

    const third = await request(app).post(endpoint).set(authHeader(adminToken));
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ error: 'rate_limited' });
  });
});
