const request = require('supertest');
const express = require('express');

describe('features routes', () => {
  let featuresRouter;
  let whatsappRouter;

  beforeAll(async () => {
    featuresRouter = (await import('../routes/orgs.features.js')).default;
    whatsappRouter = (await import('../routes/orgs.whatsapp.js')).default;
  });

  test('GET /api/orgs/:id/features returns enabled,limit,used', async () => {
    const app = express();
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
        if (sql.includes('FROM plan_features')) {
          const code = params[1];
          if (code === 'whatsapp_numbers') return { rows: [{ enabled: true, limit: 2 }] };
          return { rows: [{ enabled: false, limit: 0 }] };
        }
        if (sql.includes('FROM whatsapp_channels')) return { rows: [{ used: 1 }] };
        return { rows: [] };
      })
    };
    app.use((req, _res, next) => { req.db = mockDb; next(); });
    app.use(featuresRouter);

    const res = await request(app).get('/api/orgs/123/features');
    expect(res.statusCode).toBe(200);
    expect(res.body.whatsapp_numbers).toEqual({ enabled: true, limit: 2, used: 1 });
  });

  test('POST /api/orgs/:id/whatsapp/channels blocks when used >= limit', async () => {
    const app = express();
    app.use(express.json());
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('SELECT plan_id FROM organizations')) return { rows: [{ plan_id: 'plan1' }] };
        if (sql.includes('FROM plan_features')) return { rows: [{ enabled: true, limit: 1 }] };
        if (sql.includes('FROM whatsapp_channels')) return { rows: [{ used: 1 }] }; // usage
        return { rows: [] };
      })
    };
    app.use((req, _res, next) => { req.db = mockDb; next(); });
    app.use(whatsappRouter);

    const res = await request(app)
      .post('/api/orgs/123/whatsapp/channels')
      .set('X-Org-Id', '123')
      .send({ provider: 'baileys', phone_e164: '+123' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('feature_limit_reached');
  });

  test('XOR activate blocks when other provider active', async () => {
    const app = express();
    app.use(express.json());
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.startsWith('SELECT * FROM whatsapp_channels')) return { rows: [{ id: 'a', org_id: '123', phone_e164: '+1', provider: 'baileys' }] };
        if (sql.includes('provider<>')) return { rows: [{ id: 'b' }] }; // conflict
        return { rows: [] };
      })
    };
    app.use((req, _res, next) => { req.db = mockDb; next(); });
    app.use(whatsappRouter);

    const res = await request(app)
      .put('/api/orgs/123/whatsapp/channels/a/activate')
      .set('X-Org-Id', '123');
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('exclusive_mode');
  });
});
