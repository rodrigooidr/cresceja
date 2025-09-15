const request = require('supertest');
const express = require('express');

const fbSpy = jest.fn(() => Promise.resolve());
const igSpy = jest.fn(() => Promise.resolve());

jest.mock('../services/meta/send.js', () => ({
  sendMessengerText: (...args) => fbSpy(...args),
  sendInstagramText: (...args) => igSpy(...args),
}));

jest.mock('../services/crypto.js', () => ({ decrypt: () => 'TOKEN' }));

const db = {
  channel_accounts: [],
  conversations: [],
  messages: [],
  async query(sql, params) {
    if (sql.startsWith('SELECT * FROM conversations')) {
      const [id, org] = params;
      const row = this.conversations.find(c => c.id === id && c.org_id === org);
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith('SELECT * FROM channel_accounts WHERE id')) {
      const row = this.channel_accounts.find(a => a.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith('SELECT sent_at FROM messages')) {
      const rows = this.messages
        .filter(m => m.conversation_id === params[0] && m.direction === 'in')
        .sort((a,b) => new Date(b.sent_at) - new Date(a.sent_at));
      return { rows: rows.slice(0,1) };
    }
    if (sql.startsWith('INSERT INTO messages')) {
      this.messages.push({ org_id: params[0], conversation_id: params[1], direction:'out', text: params[3], sent_at: new Date() });
      return { rows: [] };
    }
    if (sql.startsWith('UPDATE conversations SET last_message_at')) {
      return { rows: [] };
    }
    throw new Error('Query not implemented: '+sql);
  }
};

const repo = {
  _db: db,
};

jest.mock('../services/inbox/repo.db.js', () => ({ makeDbRepo: () => repo }));

let router;
beforeAll(async () => {
  ({ default: router } = await import('../routes/inbox.send.js'));
});

function makeApp() {
  const app = express();
  app.use(express.json());
  router(app);
  return app;
}

beforeEach(() => {
  db.channel_accounts = [];
  db.conversations = [];
  db.messages = [];
  fbSpy.mockClear();
  igSpy.mockClear();
});

test('facebook within 24h allows send', async () => {
  db.channel_accounts.push({ id: 'a1', channel: 'facebook', external_account_id: 'p1', access_token_enc: {} });
  db.conversations.push({ id: 'c1', org_id: 'o1', channel: 'facebook', account_id: 'a1', external_user_id: 'u1' });
  db.messages.push({ conversation_id: 'c1', direction: 'in', sent_at: new Date().toISOString() });
  const app = makeApp();
  const res = await request(app).post('/inbox/messages').set('x-org-id','o1').send({ conversationId:'c1', text:'hi' });
  expect(res.statusCode).toBe(200);
  expect(fbSpy).toHaveBeenCalled();
});

test('instagram after 24h blocked', async () => {
  db.channel_accounts.push({ id: 'a2', channel: 'instagram', external_account_id: 'i1', access_token_enc: {} });
  db.conversations.push({ id: 'c2', org_id: 'o1', channel: 'instagram', account_id: 'a2', external_user_id: 'u1' });
  db.messages.push({ conversation_id: 'c2', direction: 'in', sent_at: new Date(Date.now()-25*60*60*1000).toISOString() });
  const app = makeApp();
  const res = await request(app).post('/inbox/messages').set('x-org-id','o1').send({ conversationId:'c2', text:'oi' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'outside_24h' });
  expect(igSpy).not.toHaveBeenCalled();
});
