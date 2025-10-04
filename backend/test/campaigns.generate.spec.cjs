const request = require('supertest');
import express from 'express';

describe('campaigns generate route', () => {
  let router;

  beforeAll(async () => {
    await jest.unstable_mockModule('../services/features.js', () => ({
      getFeatureAllowance: jest.fn().mockResolvedValue({ enabled: true, limit: null }),
      getUsage: jest.fn().mockResolvedValue(0)
    }));
    router = (await import('../routes/orgs.campaigns.generate.js')).default;
  });

  test('generates suggestions skipping blacklist and holidays', async () => {
    const app = express();
    app.use(express.json());

    const inserted = [];
    const mockDb = {
      query: jest.fn((sql, params) => {
        if (sql.includes('INSERT INTO content_campaigns')) {
          return { rows: [{ id: 'camp1' }] };
        }
        if (sql.includes('INSERT INTO content_suggestions')) {
          const id = `s${inserted.length+1}`;
          inserted.push({ id, date: params[2] });
          return { rows: [{ id, date: params[2], status: 'suggested', copy_json: {} }] };
        }
        return { rows: [] };
      })
    };
    app.use((req,res,next)=>{ req.db = mockDb; req.user = { id: 'u1', role: 'OrgAdmin' }; next(); });
    app.use(router);

    const res = await request(app)
      .post('/api/orgs/1/campaigns/generate')
      .set('X-Org-Id','1')
      .send({
        title: 'Outubro • Loja XYZ',
        monthRef: '2025-10-01',
        defaultTargets: { ig:{enabled:true,accountId:null} },
        frequency: 5,
        profile: {},
        blacklistDates: ['2025-10-12'],
        timeWindows: [{ start:'09:00', end:'21:00' }],
        timezone: 'America/Sao_Paulo'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.suggestions).toHaveLength(5);
    expect(res.body.suggestions.find(s => s.date === '2025-10-12')).toBeUndefined();
  });
});
