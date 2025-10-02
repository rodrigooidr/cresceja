const { rest } = require('msw');

const apiBase = 'http://localhost:4000';

// Fixtures mínimas esperadas pelas suítes legadas
const fixtures = {
  org: { id: '11111111-1111-1111-1111-111111111111', name: 'Org Demo', plan: 'pro' },
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'test@demo.com', name: 'Tester' },
  conversations: [
    { id: 'c1', channel: 'WhatsApp', title: 'Cliente 1', lastMessageAt: Date.now() - 10000 },
    { id: 'c2', channel: 'Instagram', title: 'Cliente 2', lastMessageAt: Date.now() - 20000 },
  ],
  messages: [
    { id: 'm1', convId: 'c1', from: 'cliente', text: 'Olá!', at: Date.now() - 9000 },
    { id: 'm2', convId: 'c1', from: 'agent', text: 'Oi! Como posso ajudar?', at: Date.now() - 8000 },
  ],
  assets: {
    page: 1,
    limit: 20,
    total: 1,
    items: [
      { id: 'a1', url: '/uploads/fake.png', mime: 'image/png', created_at: new Date().toISOString() },
    ],
  },
  posts: {
    items: [
      {
        id: 'p1',
        title: 'Post demo',
        body: 'conteúdo',
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  plans: { items: [{ id: 'starter', price_cents: 0 }, { id: 'pro', price_cents: 9900 }] },
};

const handlers = [
  // Auth
  rest.post(`${apiBase}/api/auth/login`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ token: 'jwt.mock', user: fixtures.user }));
  }),
  rest.post(`${apiBase}/api/auth/register`, async (_req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ token: 'jwt.mock', user: fixtures.user }));
  }),

  // Orgs
  rest.get(`${apiBase}/api/orgs/me`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.org));
  }),

  // Inbox (compat)
  rest.get(`${apiBase}/api/inbox/conversations`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ items: fixtures.conversations }));
  }),
  rest.get(`${apiBase}/api/inbox/conversations/:id/messages`, async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ items: fixtures.messages.filter((m) => m.convId === req.params.id) }),
    );
  }),

  // Conteúdo
  rest.get(`${apiBase}/api/content/assets`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.assets));
  }),
  rest.get(`${apiBase}/api/content/posts`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.posts));
  }),
  rest.post(`${apiBase}/api/content/posts`, async (_req, res, ctx) => {
    return res(ctx.status(201), ctx.json(fixtures.posts.items[0]));
  }),

  // Uploads
  rest.post(`${apiBase}/api/uploads`, async (_req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({ url: '/uploads/fake.png', mime: 'image/png', name: 'fake.png', size: 1234 }),
    );
  }),

  // Públicos (Planos)
  rest.get(`${apiBase}/api/public/plans`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.plans));
  }),

  // Webhook stub (apenas 200)
  rest.post(`${apiBase}/api/webhooks/meta/pages`, async (_req, res, ctx) => {
    return res(ctx.status(200));
  }),

  // Health
  rest.get(`${apiBase}/health`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ ok: true }));
  }),
];

module.exports = { handlers };
