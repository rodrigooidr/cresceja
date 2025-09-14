const request = require('supertest');
const express = require('express');

describe('campaigns edit lock', () => {
  let app;
  beforeAll(async () => {
    const router = (await import('../routes/orgs.campaigns.js')).default;
    app = express();
    app.use(express.json());
    app.use((req,res,next)=>{ req.user = { id:'u1', role:'OrgAdmin' }; req.db = {
      query: jest.fn((sql, params)=>{
        if (sql.includes('SELECT status, jobs_map FROM content_suggestions')) {
          return { rows:[{ status:'approved', jobs_map:{ instagram:'job1' } }] };
        }
        if (sql.includes('SELECT status FROM instagram_publish_jobs')) {
          return { rows:[{ status:'done' }] };
        }
        return { rows:[] };
      })
    }; next(); });
    app.use(router);
  });

  test('returns job_locked when job not pending', async () => {
    const res = await request(app)
      .patch('/api/orgs/1/suggestions/1')
      .send({ copy_json:{ text:'new' } });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error:'job_locked' });
  });
});
