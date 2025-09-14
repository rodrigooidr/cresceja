const request = require('supertest');
const express = require('express');

let router;

beforeAll(async () => {
  router = (await import('../routes/orgs.assets.js')).default;
});

function buildApp(mockDb) {
  const app = express();
  app.use(express.json());
  app.use((req,res,next)=>{ req.db = mockDb; req.user = { id: 'u1', role: 'OrgAdmin' }; next(); });
  app.use(router);
  return app;
}

test('creates and lists assets', async () => {
  const db = {
    inserted: [],
    query: jest.fn((sql, params) => {
      if (sql.startsWith('INSERT INTO content_assets')) {
        const id = `a${db.inserted.length+1}`;
        db.inserted.push({ id, url: params[1] });
        return { rows: [{ id, url: params[1] }] };
      }
      if (sql.startsWith('SELECT id as asset_id')) {
        return { rows: db.inserted.map(a => ({ asset_id: a.id, url: a.url, mime: 'image/png' })) };
      }
      if (sql.startsWith('SELECT COUNT')) {
        return { rows: [{ total: db.inserted.length }] };
      }
      return { rows: [] };
    })
  };
  const app = buildApp(db);

  const createRes = await request(app)
    .post('/api/orgs/1/assets')
    .send({ url: 'http://x/img.png', mime: 'image/png' });
  expect(createRes.statusCode).toBe(200);
  expect(createRes.body.asset_id).toBeDefined();

  const listRes = await request(app)
    .get('/api/orgs/1/assets');
  expect(listRes.statusCode).toBe(200);
  expect(listRes.body.items).toHaveLength(1);
});
