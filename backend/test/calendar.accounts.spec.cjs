const request = require('supertest');
import express from 'express';

describe('google calendar accounts routes', () => {
  let router;
  beforeAll(async () => {
    jest.resetModules();
    process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
    router = (await import('../routes/orgs.calendar.js')).default;
  });

  test('CRUD with feature limit=1', async () => {
    const app = express();
    app.use(express.json());
    const accounts = [];
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
        if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
        if (sql.includes('COUNT(*)') && sql.includes('google_calendar_accounts')) return { rows: [{ used: accounts.length }] };
        if (sql.startsWith('SELECT id, google_user_id')) return { rows: accounts };
        if (sql.startsWith('INSERT INTO google_calendar_accounts')) {
          const acc = { id: String(accounts.length + 1), google_user_id: params[1], email: params[2], display_name: params[3], is_active: true };
          accounts.push(acc);
          return { rows: [acc] };
        }
        if (sql.startsWith('DELETE FROM google_calendar_accounts')) {
          const idx = accounts.findIndex(a => a.id === params[1]);
          if (idx >= 0) accounts.splice(idx, 1);
          return { rows: [] };
        }
        return { rows: [] };
      })
    };
    app.use((req, _res, next) => { req.db = mockDb; next(); });
    app.use(router);

    const orgId = 'org1';
    const headers = { 'X-Org-Id': orgId };

    let res = await request(app).get(`/api/orgs/${orgId}/calendar/accounts`).set(headers);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);

    res = await request(app)
      .post(`/api/orgs/${orgId}/calendar/accounts`)
      .set(headers)
      .send({ google_user_id: 'g1', email: 'a@example.com', display_name: 'A' });
    expect(res.statusCode).toBe(201);
    expect(res.body.google_user_id).toBe('g1');

    res = await request(app)
      .post(`/api/orgs/${orgId}/calendar/accounts`)
      .set(headers)
      .send({ google_user_id: 'g2' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('feature_limit_reached');

    res = await request(app)
      .delete(`/api/orgs/${orgId}/calendar/accounts/1`)
      .set(headers);
    expect(res.statusCode).toBe(204);

    res = await request(app).get(`/api/orgs/${orgId}/calendar/accounts`).set(headers);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('feature disabled blocks creation', async () => {
    const app = express();
    app.use(express.json());
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
        if (sql.includes('FROM plan_features')) return { rows: [{ enabled: false, limit: 0 }] };
        return { rows: [] };
      })
    };
    app.use((req, _res, next) => { req.db = mockDb; next(); });
    app.use(router);

    const orgId = 'org2';
    const headers = { 'X-Org-Id': orgId };

    const res = await request(app)
      .post(`/api/orgs/${orgId}/calendar/accounts`)
      .set(headers)
      .send({ google_user_id: 'g1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('feature_disabled');
  });
});
