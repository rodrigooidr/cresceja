const request = require('supertest');
const express = require('express');

describe('campaigns apply targets', () => {
  let app, dbMock;
  beforeAll(async () => {
    const router = (await import('../routes/orgs.campaigns.js')).default;
    app = express();
    app.use(express.json());
    dbMock = {
      query: jest.fn((sql, params) => {
        if (sql.startsWith('UPDATE content_suggestions')) {
          expect(sql).toContain('status = ANY');
          expect(params[0]).toBe('1');
          expect(params[1]).toBe('10');
          expect(params[params.length-1]).toEqual(['suggested']);
          return { rowCount: 2 };
        }
        return { rows: [] };
      })
    };
    app.use((req,res,next)=>{ req.user={ id:'u1', role:'OrgAdmin' }; req.db=dbMock; next(); });
    app.use(router);
  });

  test('apply-all updates only suggested suggestions', async () => {
    const res = await request(app)
      .patch('/api/orgs/1/campaigns/10/suggestions/apply-targets')
      .send({ ig:{ enabled:true, accountId:'acc1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.updated).toBe(2);
  });
});
