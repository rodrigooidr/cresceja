const { rest } = require('msw');

const apiBase = 'http://localhost:4000';

// ====== FIXTURES ======
const now = Date.now();
const fixtures = {
  org: { id: '11111111-1111-1111-1111-111111111111', name: 'Org Demo', plan: 'pro' },
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'test@demo.com', name: 'Tester' },
  conversations: [
    { id: 'c1', channel: 'WhatsApp', title: 'Cliente 1', unread: 1, status: 'open', assignee: null, lastMessageAt: now - 10_000 },
    { id: 'c2', channel: 'Instagram', title: 'Cliente 2', unread: 0, status: 'open', assignee: 'agent:2222', lastMessageAt: now - 20_000 },
  ],
  messages: [
    { id: 'm1', convId: 'c1', from: 'cliente', text: 'Olá!', at: now - 9_000 },
    { id: 'm2', convId: 'c1', from: 'agent', text: 'Oi! Como posso ajudar?', at: now - 8_000 },
  ],
  assets: {
    page: 1, limit: 20, total: 1,
    items: [{ id: 'a1', url: '/uploads/fake.png', mime: 'image/png', created_at: new Date().toISOString() }],
  },
  posts: { items: [{ id: 'p1', title: 'Post demo', body: 'conteúdo', status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] },
  plans: { items: [{ id: 'starter', price_cents: 0 }, { id: 'pro', price_cents: 9900 }] },
  quickActions: [
    // lista de ações que as suítes legadas costumam pedir
    { key: 'mark_read', label: 'Marcar como lida', bulk: true },
    { key: 'mark_unread', label: 'Marcar como não lida', bulk: true },
    { key: 'assign_me', label: 'Assumir', bulk: true },
    { key: 'close', label: 'Fechar', bulk: true },
    { key: 'archive', label: 'Arquivar', bulk: true },
  ],
};

// util de id simples
function rid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

// ====== HANDLERS ======
const handlers = [
  // --- Auth ---
  rest.post(`${apiBase}/api/auth/login`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ token: 'jwt.mock', user: fixtures.user }));
  }),
  rest.post(`${apiBase}/api/auth/register`, async (_req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ token: 'jwt.mock', user: fixtures.user }));
  }),

  // --- Orgs ---
  rest.get(`${apiBase}/api/orgs/me`, async (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.org));
  }),

  // --- Inbox (lista conversas) ---
  rest.get(`${apiBase}/api/inbox/conversations`, async (req, res, ctx) => {
    // filtros simples (status/assignee/etc.) se os testes passarem querystring
    const status = req.url.searchParams.get('status');
    const assigned = req.url.searchParams.get('assigned');
    let items = fixtures.conversations.slice();
    if (status) items = items.filter(c => c.status === status);
    if (assigned === 'me') items = items.filter(c => c.assignee === `agent:${fixtures.user.id}`);
    return res(ctx.status(200), ctx.json({ items }));
  }),

  // --- Mensagens de uma conversa ---
  rest.get(`${apiBase}/api/inbox/conversations/:id/messages`, async (req, res, ctx) => {
    const convId = req.params.id;
    return res(ctx.status(200), ctx.json({ items: fixtures.messages.filter(m => m.convId === convId) }));
  }),

  // --- Envio otimista (single) ---
  // Alguns testes chamam /api/inbox/messages/send
  rest.post(`${apiBase}/api/inbox/messages/send`, async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { convId, text } = body || {};
    const id = rid('msg');
    const msg = { id, convId, from: 'agent', text: String(text || ''), at: Date.now() };
    fixtures.messages.push(msg);

    // Atualiza conversas (lastMessageAt, unread etc) conforme legado
    const conv = fixtures.conversations.find(c => c.id === convId);
    if (conv) {
      conv.lastMessageAt = msg.at;
      // ao enviar como agente, zera unread
      conv.unread = 0;
      conv.status = 'open';
      conv.assignee = conv.assignee || `agent:${fixtures.user.id}`;
    }

    // shape esperado pelo legado (ok/id/message/conv)
    return res(ctx.status(200), ctx.json({ ok: true, id, message: msg, conversation: conv }));
  }),

  // --- Envio em lote (bulk optimistic) ---
  // Alguns testes esperam /api/inbox/messages/bulk com { action: 'send', ids:[convId...], text }
  rest.post(`${apiBase}/api/inbox/messages/bulk`, async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { action, ids, text } = body || {};
    if (action !== 'send' || !Array.isArray(ids)) {
      return res(ctx.status(400), ctx.json({ ok: false, error: 'invalid_bulk_request' }));
    }
    const results = ids.map((convId) => {
      const id = rid('msg');
      const msg = { id, convId, from: 'agent', text: String(text || ''), at: Date.now() };
      fixtures.messages.push(msg);
      const conv = fixtures.conversations.find(c => c.id === convId);
      if (conv) {
        conv.lastMessageAt = msg.at;
        conv.unread = 0;
        conv.status = 'open';
        conv.assignee = conv.assignee || `agent:${fixtures.user.id}`;
      }
      return { convId, messageId: id };
    });
    return res(ctx.status(200), ctx.json({ ok: true, results }));
  }),

  // --- Quick actions (listar) ---
  rest.get(`${apiBase}/api/inbox/quick-actions`, async (_req, res, ctx) => {
    // shape simples
    return res(ctx.status(200), ctx.json({ items: fixtures.quickActions }));
  }),

  // --- Quick actions (executar 1) ---
  // POST /api/inbox/quick-actions/:action { convId }
  rest.post(`${apiBase}/api/inbox/quick-actions/:action`, async (req, res, ctx) => {
    const action = req.params.action;
    const body = await req.json().catch(() => ({}));
    const { convId } = body || {};
    const conv = fixtures.conversations.find(c => c.id === convId);
    if (!conv) return res(ctx.status(404), ctx.json({ ok: false, error: 'conversation_not_found' }));

    applyActionToConversation(conv, action, fixtures.user.id);
    return res(ctx.status(200), ctx.json({ ok: true, conversation: conv }));
  }),

  // --- Quick actions em lote ---
  // POST /api/inbox/quick-actions/bulk { action, ids:[] }
  rest.post(`${apiBase}/api/inbox/quick-actions/bulk`, async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { action, ids } = body || {};
    if (!action || !Array.isArray(ids)) {
      return res(ctx.status(400), ctx.json({ ok: false, error: 'invalid_bulk_request' }));
    }
    const updated = [];
    ids.forEach((convId) => {
      const conv = fixtures.conversations.find(c => c.id === convId);
      if (conv) {
        applyActionToConversation(conv, action, fixtures.user.id);
        updated.push(conv);
      }
    });
    return res(ctx.status(200), ctx.json({ ok: true, updated }));
  }),

  // --- Atualização parcial da conversa ---
  // PATCH /api/inbox/conversations/:id { status?, assignee?, unread? }
  rest.patch(`${apiBase}/api/inbox/conversations/:id`, async (req, res, ctx) => {
    const id = req.params.id;
    const body = await req.json().catch(() => ({}));
    const conv = fixtures.conversations.find(c => c.id === id);
    if (!conv) return res(ctx.status(404), ctx.json({ ok: false, error: 'conversation_not_found' }));

    if (typeof body.status === 'string') conv.status = body.status;
    if (typeof body.assignee === 'string' || body.assignee === null) conv.assignee = body.assignee;
    if (typeof body.unread === 'number') conv.unread = body.unread;

    return res(ctx.status(200), ctx.json({ ok: true, conversation: conv }));
  }),

  // --- Conteúdo / Uploads / Públicos (já existiam) ---
  rest.get(`${apiBase}/api/content/assets`, async (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.assets))),
  rest.get(`${apiBase}/api/content/posts`, async (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.posts))),
  rest.post(`${apiBase}/api/content/posts`, async (_req, res, ctx) => res(ctx.status(201), ctx.json(fixtures.posts.items[0]))),
  rest.post(`${apiBase}/api/uploads`, async (_req, res, ctx) => res(ctx.status(201), ctx.json({ url: '/uploads/fake.png', mime: 'image/png', name: 'fake.png', size: 1234 }))),
  rest.get(`${apiBase}/api/public/plans`, async (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.plans))),

  // --- Webhook stub ---
  rest.post(`${apiBase}/api/webhooks/meta/pages`, async (_req, res, ctx) => res(ctx.status(200))),

  // --- Health ---
  rest.get(`${apiBase}/health`, async (_req, res, ctx) => res(ctx.status(200), ctx.json({ ok: true }))),
];

// ====== helpers ======
function applyActionToConversation(conv, action, userId) {
  switch (action) {
    case 'mark_read':
      conv.unread = 0;
      break;
    case 'mark_unread':
      conv.unread = (conv.unread || 0) + 1;
      break;
    case 'assign_me':
      conv.assignee = `agent:${userId}`;
      break;
    case 'close':
      conv.status = 'closed';
      break;
    case 'archive':
      conv.status = 'archived';
      break;
    default:
      // no-op para desconhecidas
      break;
  }
}

module.exports = { handlers, fixtures };
