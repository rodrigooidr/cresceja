const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

let router;
let setInboxRepo;
let makeMemoryRepo;
let inboxRoutes;

beforeAll(async () => {
  ({ default: router } = await import('../routes/webhooks/meta.js'));
  ({ setInboxRepo, makeMemoryRepo } = await import('../services/inbox/repo.js'));
  ({ default: inboxRoutes } = await import('../routes/inbox.js'));
});

function makeApp() {
  const app = express();
  app.use('/api/webhooks/meta', express.raw({ type: '*/*' }), router);
  app.use(express.json());
  inboxRoutes(app);
  return app;
}

beforeEach(async () => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  await repo.seedChannelAccount({ org_id: 'org_test', channel: 'instagram', external_account_id: 'IG_USER_ID', name: 'IG A' });
  await repo.seedChannelAccount({ org_id: 'org_test', channel: 'facebook', external_account_id: 'PAGE_ID', name: 'FB A' });
});

test('messenger webhook persists conversation', async () => {
  process.env.META_APP_SECRET = 'secret';
  const bodyObj = {
    object: 'page',
    entry: [
      {
        id: 'PAGE_ID',
        messaging: [
          {
            sender: { id: 'u1' },
            message: { mid: 'm1', text: 'hello' },
            timestamp: 100,
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(bodyObj);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  const app = makeApp();
  const res = await request(app)
    .post('/api/webhooks/meta')
    .set('X-Hub-Signature-256', sig)
    .set('Content-Type', 'application/json')
    .send(body);
  expect(res.statusCode).toBe(200);

  const list = await request(app).get('/inbox/conversations?orgId=org_test');
  expect(list.statusCode).toBe(200);
  expect(list.body.total).toBe(1);
  const conv = list.body.items[0];
  expect(conv.channel).toBe('facebook');

  const msgs = await request(app).get(`/inbox/conversations/${conv.id}/messages`);
  expect(msgs.statusCode).toBe(200);
  expect(msgs.body.total).toBe(1);
  expect(msgs.body.items[0]).toMatchObject({ text: 'hello', direction: 'in' });
});

test('instagram webhook persists conversation', async () => {
  process.env.META_APP_SECRET = 'secret';
  const bodyObj = {
    object: 'instagram',
    entry: [
      {
        id: 'IG_USER_ID',
        changes: [
          {
            value: {
              timestamp: '200',
              thread_id: 't1',
              messages: [
                { id: 'm2', from: { id: 'u2' }, text: 'hi', attachments: [] },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(bodyObj);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  const app = makeApp();
  const res = await request(app)
    .post('/api/webhooks/meta')
    .set('X-Hub-Signature-256', sig)
    .set('Content-Type', 'application/json')
    .send(body);
  expect(res.statusCode).toBe(200);

  const list = await request(app).get('/inbox/conversations?orgId=org_test');
  expect(list.statusCode).toBe(200);
  expect(list.body.total).toBe(1);
  const conv = list.body.items[0];
  expect(conv.channel).toBe('instagram');

  const msgs = await request(app).get(`/inbox/conversations/${conv.id}/messages`);
  expect(msgs.statusCode).toBe(200);
  expect(msgs.body.total).toBe(1);
  expect(msgs.body.items[0]).toMatchObject({ text: 'hi', direction: 'in' });
});
