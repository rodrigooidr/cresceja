const request = require('supertest');
const express = require('express');

const fbSub = jest.fn(() => Promise.resolve());
const igSub = jest.fn(() => Promise.resolve());

jest.mock('../services/meta/subscribe.js', () => ({
  subscribeFacebook: (...a) => fbSub(...a),
  subscribeInstagram: (...a) => igSub(...a),
}));

jest.mock('../services/crypto.js', () => ({ decrypt: () => 'TOKEN' }));

const db = {
  channel_accounts: [],
  async query(sql, params) {
    if (sql.startsWith('SELECT * FROM channel_accounts WHERE org_id')) {
      const [org, channel] = params;
      let rows = this.channel_accounts.filter(c => c.org_id === org);
      if (channel) rows = rows.filter(r => r.channel === channel);
      return { rows };
    }
    if (sql.startsWith('SELECT * FROM channel_accounts WHERE id')) {
      const row = this.channel_accounts.find(a => a.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith('UPDATE channel_accounts SET webhook_subscribed')) {
      const row = this.channel_accounts.find(a => a.id === params[0]);
      if (row) row.webhook_subscribed = true;
      return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM channel_accounts')) {
      const id = params[0];
      this.channel_accounts = this.channel_accounts.filter(a => a.id !== id);
      return { rows: [] };
    }
    throw new Error('Query not implemented: ' + sql);
  }
};

const repo = { _db: db, seedChannelAccount: async (row) => { const rec = { id: String(Date.now()), ...row }; db.channel_accounts.push(rec); return rec; } };

jest.mock('../services/inbox/repo.db.js', () => ({ makeDbRepo: () => repo }));

let router;
beforeAll(async () => {
  ({ default: router } = await import('../routes/channels/meta.js'));
});

function makeApp() {
  const app = express();
  app.use(express.json());
  router(app);
  return app;
}

beforeEach(() => {
  db.channel_accounts = [];
  fbSub.mockClear();
  igSub.mockClear();
});

test('list subscribe and delete accounts', async () => {
  db.channel_accounts.push({ id:'1', org_id:'o1', channel:'facebook', external_account_id:'p1', access_token_enc:{} });
  db.channel_accounts.push({ id:'2', org_id:'o1', channel:'instagram', external_account_id:'i1', access_token_enc:{} });
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
