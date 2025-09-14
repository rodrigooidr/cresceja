const request = require('supertest');
const express = require('express');

describe('campaigns jobs view', () => {
  let app, dbMock;
  beforeAll(async () => {
    const router = (await import('../routes/orgs.campaigns.js')).default;
    app = express();
    app.use(express.json());
    dbMock = {
      query: jest.fn((sql, params) => {
        if (sql.includes('FROM content_suggestions')) {
          return { rows:[{ jobs_map:{ instagram:'jobIg', facebook:'jobFb' } }] };
        }
        if (sql.includes('FROM instagram_publish_jobs')) {
          return { rows:[{ status:'pending' }] };
        }
        if (sql.includes('FROM facebook_publish_jobs')) {
          return { rows:[{ status:'done' }] };
        }
        return { rows:[] };
      })
    };
    app.use((req,res,next)=>{ req.user={ id:'u1', role:'OrgAdmin' }; req.db=dbMock; next(); });
    app.use(router);
  });

  test('returns job statuses from jobs_map', async () => {
    const res = await request(app).get('/api/orgs/1/suggestions/5/jobs');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ig: { jobId:'jobIg', status:'pending' },
      fb: { jobId:'jobFb', status:'done' }
    });
  });
});
