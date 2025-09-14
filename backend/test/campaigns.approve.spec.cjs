const request = require('supertest');
const express = require('express');

describe('campaigns approve', () => {
  let app, dbMock;
  beforeAll(async () => {
    const router = (await import('../routes/orgs.campaigns.approve.js')).default;
    app = express();
    app.use(express.json());
    dbMock = {
      query: jest.fn((sql, params)=>{
        if (sql.includes('SELECT date,time,channel_targets,copy_json,asset_refs,status FROM content_suggestions')) {
          return { rows:[{ date:'2024-01-10', time:'10:00', channel_targets:{ instagram:{ enabled:true, accountId:'ig1' }, facebook:{ enabled:true, pageId:'fb1' } }, copy_json:{ text:'hi' }, asset_refs:[{ asset_id:'a1', type:'image' }], status:'suggested' }] };
        }
        if (sql.includes('SELECT id,url,mime FROM content_assets')) {
          return { rows:[{ id:'a1', url:'https://img/a1.jpg', mime:'image/jpeg' }] };
        }
        if (sql.includes('INSERT INTO instagram_publish_jobs')) {
          return { rows:[{ id:'jobIg1' }] };
        }
        if (sql.includes('INSERT INTO facebook_publish_jobs')) {
          return { rows:[{ id:'jobFb1' }] };
        }
        if (sql.includes('UPDATE content_suggestions')) {
          return { rows:[{ id:'s1', status:'approved', approved_at:'2024-01-01T00:00:00Z', jobs_map:{ instagram:'jobIg1', facebook:'jobFb1' } }] };
        }
        return { rows:[] };
      })
    };
    app.use((req,res,next)=>{ req.user = { id:'u1', role:'OrgAdmin' }; req.db = dbMock; next(); });
    app.use(router);
  });

  test('approving suggestion creates jobs and updates jobs_map', async () => {
    const res = await request(app).post('/api/orgs/1/suggestions/1/approve');
    expect(res.statusCode).toBe(200);
    expect(res.body.jobs_map).toEqual({ instagram:'jobIg1', facebook:'jobFb1' });
    expect(dbMock.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO instagram_publish_jobs'), expect.any(Array));
    expect(dbMock.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO facebook_publish_jobs'), expect.any(Array));
  });
});
