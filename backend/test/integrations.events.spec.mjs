import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { createIntegrationsEventsRouter } from '../routes/integrations.events.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createTestDb } from './utils/db.mem.mjs';
import { runMigrations } from './utils/runMigrations.mjs';

const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function getErrorBody(response) {
  try {
    return response.body;
  } catch {
    return {};
  }
}

describe('integrations events router', () => {
  let db;
  let app;
  let orgId;
  let otherOrgId;
  let adminToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev-secret';
    db = createTestDb();
    await runMigrations({ db });
    orgId = randomUUID();
    otherOrgId = randomUUID();
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`, [
      orgId,
      'Org Test',
      'org-test',
    ]);
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`, [
      otherOrgId,
      'Org B',
      'org-b',
    ]);
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

  beforeEach(async () => {
    await db.query('TRUNCATE integration_events RESTART IDENTITY CASCADE');
  });

  function buildApp() {
    const application = express();
    application.use(express.json());
    application.use((req, _res, next) => {
      req.db = db;
      next();
    });
    const router = createIntegrationsEventsRouter({ logger: fakeLogger });
    const guard = requireRole('OrgAdmin', 'OrgOwner');
    application.use('/api/integrations', authRequired, guard, router);
    application.use((err, _req, res, _next) => {
      res.status(500).json({ error: 'unhandled', message: err.message });
    });
    return application;
  }

  async function insertEvent({ org = orgId, provider, payload = {}, eventType = null, receivedAt }) {
    const date = receivedAt || new Date();
    await db.query(
      `INSERT INTO integration_events (org_id, provider, payload, event_type, received_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [org, provider, JSON.stringify(payload), eventType, date.toISOString()]
    );
  }

  it('returns events filtered by provider with pagination', async () => {
    await insertEvent({
      provider: 'meta_facebook',
      payload: { message: 'first', access_token: 'secret-token' },
      eventType: 'messages',
      receivedAt: new Date(Date.now() - 1000 * 60),
    });
    await insertEvent({
      provider: 'meta_facebook',
      payload: { message: 'second' },
      eventType: 'messages',
      receivedAt: new Date(),
    });
    await insertEvent({
      provider: 'meta_instagram',
      payload: { message: 'ignored' },
      eventType: 'messages',
    });

    const response = await request(app)
      .get('/api/integrations/events?provider=meta_facebook&limit=2')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    for (const item of response.body.items) {
      expect(item.provider).toBe('meta_facebook');
      expect(item.summary).toBeTruthy();
      if (item.payload?.access_token) {
        expect(item.payload.access_token).toBe('[REDACTED]');
      }
    }
  });

  it('respects orgId filter and excludes events from other orgs', async () => {
    await insertEvent({
      provider: 'meta_facebook',
      payload: { message: 'primary org' },
    });
    await insertEvent({
      org: otherOrgId,
      provider: 'meta_facebook',
      payload: { message: 'other org' },
    });

    const defaultOrgResponse = await request(app)
      .get('/api/integrations/events?provider=meta_facebook&limit=10')
      .set(authHeader(adminToken));

    expect(defaultOrgResponse.status).toBe(200);
    expect(defaultOrgResponse.body.items.every((item) => item.org_id === orgId)).toBe(true);

    const otherOrgResponse = await request(app)
      .get(`/api/integrations/events?provider=meta_facebook&limit=10&orgId=${otherOrgId}`)
      .set(authHeader(adminToken));

    expect(otherOrgResponse.status).toBe(200);
    expect(otherOrgResponse.body.items.every((item) => item.org_id === otherOrgId)).toBe(true);
    expect(otherOrgResponse.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/integrations/events');
    expect(response.status).toBe(401);
    expect(getErrorBody(response)).toHaveProperty('error');
  });
});
