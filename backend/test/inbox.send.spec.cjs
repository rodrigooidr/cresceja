const request = require('supertest');
const express = require('express');

const fbSpy = jest.fn(() => Promise.resolve());
const igSpy = jest.fn(() => Promise.resolve());

let router;
let setInboxRepo;
let makeMemoryRepo;
let getInboxRepo;

beforeAll(async () => {
  await jest.unstable_mockModule('../services/meta/send.js', () => ({
    sendMessengerText: (...args) => fbSpy(...args),
    sendInstagramText: (...args) => igSpy(...args),
  }));
  await jest.unstable_mockModule('../services/crypto.js', () => ({ decrypt: () => 'TOKEN' }));
  ({ default: router } = await import('../routes/inbox.send.js'));
  ({ setInboxRepo, makeMemoryRepo, getInboxRepo } = await import('../services/inbox/repo.js'));
});

function makeApp() {
  const app = express();
  app.use(express.json());
  router(app);
  return app;
}

beforeEach(async () => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  await repo.seedChannelAccount({ id: 'a1', org_id: 'o1', channel: 'facebook', external_account_id: 'p1', access_token: 'tok' });
  await repo.seedChannelAccount({ id: 'a2', org_id: 'o1', channel: 'instagram', external_account_id: 'ig1', access_token: 'tok' });
  fbSpy.mockClear();
  igSpy.mockClear();
});

test('facebook within 24h allows send', async () => {
  const repo = getInboxRepo();
  const conv = await repo.createConversation({
    org_id: 'o1',
    channel: 'facebook',
    account_id: 'a1',
    external_user_id: 'u1',
    contact_id: 'ct1',
    last_message_at: new Date(),
    status: 'open',
    unread_count: 0,
  });
  await repo.createMessage({
    org_id: 'o1',
    conversation_id: conv.id,
    external_message_id: 'in_1',
    direction: 'in',
    text: 'hello',
    attachments_json: [],
    sent_at: new Date(),
    raw_json: {},
  });
  const app = makeApp();
  const res = await request(app)
    .post('/inbox/messages')
    .set('x-org-id', 'o1')
    .send({ conversationId: conv.id, text: 'hi' });
  expect(res.statusCode).toBe(200);
  expect(fbSpy).toHaveBeenCalled();
});

test('instagram after 24h blocked', async () => {
  const repo = getInboxRepo();
  const conv = await repo.createConversation({
    org_id: 'o1',
    channel: 'instagram',
    account_id: 'a2',
    external_user_id: 'u2',
    contact_id: 'ct2',
    last_message_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
    status: 'open',
    unread_count: 0,
  });
  await repo.createMessage({
    org_id: 'o1',
    conversation_id: conv.id,
    external_message_id: 'in_old',
    direction: 'in',
    text: 'old',
    attachments_json: [],
    sent_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
    raw_json: {},
  });
  const app = makeApp();
  const res = await request(app)
    .post('/inbox/messages')
    .set('x-org-id', 'o1')
    .send({ conversationId: conv.id, text: 'oi' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'outside_24h' });
  expect(igSpy).not.toHaveBeenCalled();
});
