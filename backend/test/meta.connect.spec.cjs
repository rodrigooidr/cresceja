const request = require('supertest');
import express from 'express';

const axiosGet = jest.fn();
const fbSub = jest.fn(() => Promise.resolve());
const igSub = jest.fn(() => Promise.resolve());

let router;
let setInboxRepo;
let makeMemoryRepo;
let getInboxRepo;

beforeAll(async () => {
  process.env.CRESCEJA_ENC_KEY = '12345678901234567890123456789012';
  await jest.unstable_mockModule('axios', () => ({
    default: { get: axiosGet },
    get: axiosGet,
  }));
  await jest.unstable_mockModule('../services/meta/subscribe.js', () => ({
    subscribeFacebook: (...args) => fbSub(...args),
    subscribeInstagram: (...args) => igSub(...args),
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
  axiosGet.mockReset();
  fbSub.mockClear();
  igSub.mockClear();
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
});

test('connect via user token seeds facebook and instagram accounts', async () => {
  const app = makeApp();
  axiosGet.mockImplementation((url) => {
    if (url.includes('/oauth/access_token')) {
      return Promise.resolve({ data: { access_token: 'LONG_TOKEN' } });
    }
    if (url.includes('/me/accounts')) {
      return Promise.resolve({
        data: {
          data: [
            {
              id: '111',
              name: 'Page One',
              access_token: 'PAGE1_TOKEN',
              perms: ['pages_messaging', 'instagram_manage_messages'],
            },
            {
              id: '222',
              name: 'Page Two',
              access_token: 'PAGE2_TOKEN',
              perms: ['pages_messaging'],
            },
          ],
        },
      });
    }
    if (url.endsWith('/111')) {
      return Promise.resolve({
        data: {
          instagram_business_account: { id: 'ig_123', username: 'igone' },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });

  const resp = await request(app)
    .post('/channels/meta/accounts/connect')
    .send({ userAccessToken: 'SHORT' });

  expect(resp.statusCode).toBe(200);
  expect(resp.body.items.length).toBeGreaterThanOrEqual(3);
  const channels = resp.body.items.reduce((acc, item) => {
    acc[item.channel] = (acc[item.channel] || 0) + 1;
    return acc;
  }, {});
  expect(channels.facebook).toBeGreaterThanOrEqual(2);
  expect(channels.instagram).toBeGreaterThanOrEqual(1);
  expect(resp.body.items.every((it) => it.webhook_subscribed === true)).toBe(true);
  expect(fbSub).toHaveBeenCalledWith('111', 'PAGE1_TOKEN');
  expect(fbSub).toHaveBeenCalledWith('222', 'PAGE2_TOKEN');
  expect(igSub).toHaveBeenCalledWith('ig_123', 'PAGE1_TOKEN');

  const repo = getInboxRepo();
  const stored = await repo.listChannelAccounts({ org_id: 'org_test' });
  expect(stored.some((acc) => acc.channel === 'instagram' && acc.username === 'igone')).toBe(true);
  expect(stored.every((acc) => acc.access_token_enc && acc.access_token_enc.c)).toBe(true);
});

test('connect accepts manual accounts payload', async () => {
  const app = makeApp();
  axiosGet.mockResolvedValue({ data: {} });
  const resp = await request(app)
    .post('/channels/meta/accounts/connect')
    .send({
      accounts: [
        {
          channel: 'facebook',
          external_account_id: '777',
          name: 'Manual Page',
          access_token: 'MANUAL_TOKEN',
          permissions_json: ['pages_messaging'],
        },
      ],
    });
  expect(resp.statusCode).toBe(200);
  expect(resp.body.items.length).toBe(1);
  const item = resp.body.items[0];
  expect(item.channel).toBe('facebook');
  expect(item.webhook_subscribed).toBe(true);
  expect(fbSub).toHaveBeenCalledWith('777', 'MANUAL_TOKEN');
});
