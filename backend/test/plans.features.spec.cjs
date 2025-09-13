const request = require('supertest');
const express = require('express');

describe('admin plans features routes', () => {
  let router;
  beforeAll(async () => {
    router = (await import('../routes/admin/plans.features.js')).default;
  });

  test('GET lista features trazendo defaults/atuais', async () => {
    const featureDefs = [
      { code: 'whatsapp_numbers', label: 'WhatsApp – Quantidade de números', type: 'number', unit: null, category: 'whatsapp' },
      { code: 'whatsapp_mode_baileys', label: 'WhatsApp – Baileys habilitado', type: 'boolean', unit: null, category: 'whatsapp' }
    ];
    const planFeatures = {
      whatsapp_numbers: { enabled: true, limit: 1 },
      whatsapp_mode_baileys: { enabled: false, limit: 1 }
    };
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('FROM feature_defs')) {
          const rows = featureDefs.map(d => ({
            ...d,
            enabled: planFeatures[d.code]?.enabled ?? false,
            limit: planFeatures[d.code]?.limit ?? null,
          }));
          return { rows };
        }
        if (sql.includes('SELECT id, name FROM plans')) {
          return { rows: [{ id: 'plan1', name: 'Plan 1' }] };
        }
        return { rows: [] };
      })
    };
    const app = express();
    app.use((req, _res, next) => { req.user = { role: 'SuperAdmin' }; req.db = mockDb; next(); });
    app.use('/api/admin/plans', router);

    const res = await request(app).get('/api/admin/plans/plan1/features');
    expect(res.statusCode).toBe(200);
    const feat = res.body.find(f => f.code === 'whatsapp_numbers');
    expect(feat.value.limit).toBe(1);
    const b = res.body.find(f => f.code === 'whatsapp_mode_baileys');
    expect(b.value.enabled).toBe(false);
  });

  test('PUT faz UPSERT e GET reflete mudança', async () => {
    const featureDefs = [
      { code: 'whatsapp_numbers', label: 'WhatsApp – Quantidade de números', type: 'number', unit: null, category: 'whatsapp' },
      { code: 'google_calendar_accounts', label: 'Google Calendar', type: 'number', unit: null, category: 'google' }
    ];
    const planFeatures = {};
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('FROM feature_defs')) {
          const rows = featureDefs.map(d => ({
            ...d,
            enabled: planFeatures[d.code]?.enabled ?? false,
            limit: planFeatures[d.code]?.limit ?? null,
          }));
          return { rows };
        }
        if (sql.startsWith('INSERT INTO plan_features')) {
          const [, , val] = params;
          planFeatures[params[1]] = JSON.parse(val);
          return { rows: [] };
        }
        if (sql.includes('SELECT id, name FROM plans')) {
          return { rows: [{ id: 'plan1', name: 'Plan 1' }] };
        }
        return { rows: [] };
      })
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { role: 'SuperAdmin' }; req.db = mockDb; next(); });
    app.use('/api/admin/plans', router);

    const body = {
      features: {
        whatsapp_numbers: { enabled: true, limit: 3 },
        google_calendar_accounts: { enabled: true, limit: 2 }
      }
    };
    const putRes = await request(app).put('/api/admin/plans/plan1/features').send(body);
    expect(putRes.statusCode).toBe(200);
    const getRes = await request(app).get('/api/admin/plans/plan1/features');
    const feat = getRes.body.find(f => f.code === 'whatsapp_numbers');
    expect(feat.value.limit).toBe(3);
  });

  test('403 quando user não tem role', async () => {
    const app = express();
    app.use((req, _res, next) => { req.user = { role: 'OrgAdmin' }; next(); });
    app.use('/api/admin/plans', router);
    const res = await request(app).get('/api/admin/plans');
    expect(res.statusCode).toBe(403);
  });
});
