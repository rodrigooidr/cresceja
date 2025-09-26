const request = require('supertest');
const express = require('express');

let router;

beforeAll(async () => {
  jest.resetModules();
  process.env.S3_BUCKET = 'b';
  process.env.S3_ACCESS_KEY_ID = 'a';
  process.env.S3_SECRET_ACCESS_KEY = 's';
  router = (await import('../routes/uploads.js')).default;
});

function app() {
  const app = express();
  app.use(express.json());
  app.use((req,_res,next)=>{ req.user={ org_id:'o1', role:'OrgAgent', roles:[] }; next(); });
  app.use('/api/uploads', router);
  return app;
}

test('invalid contentType returns 400', async () => {
  const res = await request(app()).post('/api/uploads/sign').send({ contentType:'text/plain', size:10 });
  expect(res.statusCode).toBe(400);
});

test('oversized image returns 400', async () => {
  const res = await request(app()).post('/api/uploads/sign').send({ contentType:'image/jpeg', size:11*1024*1024 });
  expect(res.statusCode).toBe(400);
});
