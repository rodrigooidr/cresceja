const request = require('supertest');
import express from 'express';

const fbSub = jest.fn(() => Promise.resolve());
const igSub = jest.fn(() => Promise.resolve());

let router;
let setInboxRepo;
let makeMemoryRepo;
let getInboxRepo;

beforeAll(async () => {
  await jest.unstable_mockModule('../services/meta/subscribe.js', () => ({
    subscribeFacebook: (...a) => fbSub(...a),
    subscribeInstagram: (...a) => igSub(...a),
  }));
  await jest.unstable_mockModule('../services/crypto.js', () => ({
    decrypt: () => 'TOKEN',
    encrypt: (value) => value,
  }));
  ({ default: router } = await import('../routes/channels/meta.js'));
  ({ setInboxRepo, makeMemoryRepo, getInboxRepo } = await import('../services/inbox/repo.js'));
});

function makeApp() {
  const app = express();
  app.use(express.json());
  router(app);
  return app;
}

beforeEach(() => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  fbSub.mockClear();
  igSub.mockClear();
});

test('list subscribe and delete accounts', async () => {
  const repo = getInboxRepo();
  await repo.seedChannelAccount({ id: '1', org_id: 'o1', channel: 'facebook', external_account_id: 'p1', access_token: 'tok' });
  await repo.seedChannelAccount({ id: '2', org_id: 'o1', channel: 'instagram', external_account_id: 'i1', access_token: 'tok' });
  const app = makeApp();
  const list = await request(app).get('/channels/meta/accounts').set('x-org-id','o1');
  expect(list.statusCode).toBe(200);
  expect(list.body.items.length).toBe(2);

  const listFb = await request(app).get('/channels/meta/accounts?channel=facebook').set('x-org-id','o1');
  expect(listFb.body.items.length).toBe(1);

  const sub = await request(app).post('/channels/meta/accounts/1/subscribe');
  expect(sub.statusCode).toBe(200);
  expect(fbSub).toHaveBeenCalled();

  const del = await request(app).delete('/channels/meta/accounts/1');
  expect(del.statusCode).toBe(200);
  const list2 = await request(app).get('/channels/meta/accounts').set('x-org-id','o1');
  expect(list2.body.items.length).toBe(1);
});
