const request = require('supertest');
const express = require('express');

const axiosGet = jest.fn();
const attachmentWorker = jest.fn();

let router;
let inboxRoutes;
let setInboxRepo;
let makeMemoryRepo;
let getInboxRepo;

beforeAll(async () => {
  await jest.unstable_mockModule('axios', () => ({
    __esModule: true,
    default: { get: (...args) => axiosGet(...args) },
    get: (...args) => axiosGet(...args),
  }));
  await jest.unstable_mockModule('../jobs/ingest_attachments.js', () => ({
    enqueueAttachmentDownload: (...args) => attachmentWorker(...args),
  }));
  ({ default: router } = await import('../routes/channels/meta.js'));
  ({ default: inboxRoutes } = await import('../routes/inbox.js'));
  ({ setInboxRepo, makeMemoryRepo, getInboxRepo } = await import('../services/inbox/repo.js'));
});

function makeApp() {
  const app = express();
  app.use(express.json());
  router(app);
  inboxRoutes(app);
  return app;
}

beforeEach(() => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  attachmentWorker.mockReset();
  axiosGet.mockReset();
});

test('facebook backfill imports recent messages', async () => {
  const repo = getInboxRepo();
  await repo.seedChannelAccount({
    id: 'fb1',
    org_id: 'org_test',
    channel: 'facebook',
    external_account_id: 'PAGE_ID',
    access_token: 'TOKEN',
  });

  const nowIso = new Date().toISOString();
  axiosGet.mockResolvedValueOnce({
    data: {
      data: [
        {
          id: 't1',
          messages: {
            data: [
              {
                id: 'mid.1',
                from: { id: 'user1' },
                message: 'hello',
                created_time: nowIso,
                attachments: { data: [] },
              },
            ],
          },
        },
      ],
    },
  });

  const app = makeApp();
  const res = await request(app).post('/channels/meta/accounts/fb1/backfill');
  expect(res.statusCode).toBe(200);
  expect(res.body.imported).toMatchObject({ messages: 1, conversations: 1 });

  const list = await request(app).get('/inbox/conversations?orgId=org_test');
  expect(list.body.total).toBe(1);
  const convId = list.body.items[0].id;
  const msgs = await request(app).get(`/inbox/conversations/${convId}/messages`);
  expect(msgs.body.total).toBe(1);
  expect(msgs.body.items[0].text).toBe('hello');
});

test('instagram backfill imports messages', async () => {
  const repo = getInboxRepo();
  await repo.seedChannelAccount({
    id: 'ig1',
    org_id: 'org_test',
    channel: 'instagram',
    external_account_id: 'IG_ID',
    access_token: 'TOKEN',
  });

  const nowIso = new Date().toISOString();
  axiosGet.mockResolvedValueOnce({
    data: {
      data: [
        {
          id: 'thread1',
          messages: {
            data: [
              {
                id: 'igmid.1',
                from: { id: 'ig_user' },
                text: 'oi',
                created_time: nowIso,
                attachments: { data: [] },
              },
            ],
          },
        },
      ],
    },
  });

  const app = makeApp();
  const res = await request(app).post('/channels/meta/accounts/ig1/backfill');
  expect(res.statusCode).toBe(200);
  expect(res.body.imported).toMatchObject({ messages: 1, conversations: 1 });

  const list = await request(app).get('/inbox/conversations?orgId=org_test');
  expect(list.body.total).toBe(1);
  const convId = list.body.items[0].id;
  const msgs = await request(app).get(`/inbox/conversations/${convId}/messages`);
  expect(msgs.body.total).toBe(1);
  expect(msgs.body.items[0].text).toBe('oi');
});
